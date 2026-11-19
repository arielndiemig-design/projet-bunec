const crypto = require("node:crypto");
const { pool, query, isDatabaseConfigured } = require("../config/database");
const { isProduction, SESSION_SECRET } = require("../config/env");
const { bansDatabase } = require("../data/store");

function unavailableError() {
  const error = new Error("Les publications de démonstration sont désactivées en production.");
  error.statusCode = 503;
  return error;
}

function mapBan(row) {
  const asDate = (value) => (value instanceof Date ? value.toISOString() : value);
  return {
    id: row.id,
    referenceLegaleBan: row.reference_legale_ban,
    centreEtatCivil: row.centre_nom,
    regionNom: row.region_nom,
    regionId: row.region_id,
    communeNom: row.commune_nom,
    communeId: row.commune_id,
    epoux: {
      nom: row.epoux_nom,
      prenom: row.epoux_prenom,
      photoUrl: "",
      dateNaissance: asDate(row.epoux_date_naissance),
      lieuNaissance: row.epoux_lieu_naissance,
      profession: row.epoux_profession,
      domicile: row.epoux_domicile,
      pere: row.epoux_pere_nom_complet,
      mere: row.epoux_mere_nom_complet,
    },
    epouse: {
      nom: row.epouse_nom,
      prenom: row.epouse_prenom,
      photoUrl: "",
      dateNaissance: asDate(row.epouse_date_naissance),
      lieuNaissance: row.epouse_lieu_naissance,
      profession: row.epouse_profession,
      domicile: row.epouse_domicile,
      pere: row.epouse_pere_nom_complet,
      mere: row.epouse_mere_nom_complet,
    },
    regimeMatrimonial: row.regime_matrimonial,
    coutumeMatrimoniale: row.coutume_matrimoniale,
    dateDebutAffichage: asDate(row.date_debut_affichage),
    dateFinAffichage: asDate(row.date_fin_affichage),
    datePrevueCelebration: asDate(row.date_prevue_celebration),
    lieuPrevuCelebration: row.lieu_prevu_celebration,
    statutBan: row.statut_ban,
    officierCelebrantNom: row.officier_celebrant_nom,
    documentAvisOfficielUrl: row.document_avis_officiel_url,
    documentThumbnailUrl: row.document_thumbnail_url,
    hashCertifieSha256: row.hash_certifie_sha256,
  };
}

function oppositionError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isDisplayPeriodOpen(startValue, endValue) {
  const startsAt = new Date(startValue);
  const endsAt = new Date(endValue);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
    return false;
  }
  startsAt.setUTCHours(0, 0, 0, 0);
  endsAt.setUTCHours(23, 59, 59, 999);
  return startsAt.getTime() <= Date.now() && endsAt.getTime() >= Date.now();
}

class BanModel {
  static async findAll() {
    if (isDatabaseConfigured()) {
      const result = await query(
        `SELECT
           b.*,
           ce.nom AS centre_nom,
           r.nom AS region_nom,
           c.nom AS commune_nom
         FROM publications_bans b
         JOIN centres_etat_civil ce ON ce.id = b.centre_id
         JOIN regions r ON r.id = b.region_id
         JOIN communes c ON c.id = b.commune_id
         ORDER BY b.date_debut_affichage DESC`,
      );
      return result.rows.map(mapBan);
    }
    if (isProduction) throw unavailableError();
    return bansDatabase;
  }

  static async findById(id) {
    if (isDatabaseConfigured()) {
      const result = await query(
        `SELECT
           b.*,
           ce.nom AS centre_nom,
           r.nom AS region_nom,
           c.nom AS commune_nom
         FROM publications_bans b
         JOIN centres_etat_civil ce ON ce.id = b.centre_id
         JOIN regions r ON r.id = b.region_id
         JOIN communes c ON c.id = b.commune_id
         WHERE b.id::text = $1 OR b.reference_legale_ban = $1
         LIMIT 1`,
        [id],
      );
      return result.rows[0] ? mapBan(result.rows[0]) : null;
    }
    if (isProduction) throw unavailableError();
    return bansDatabase.find((b) => b.id === id) || null;
  }

  static async addOpposition(banId, oppositionData) {
    if (isDatabaseConfigured()) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const found = await client.query(
          `SELECT id, statut_ban::text AS statut_ban,
                  date_debut_affichage > CURRENT_DATE AS periode_non_commencee,
                  date_fin_affichage < CURRENT_DATE AS periode_expiree
           FROM publications_bans
           WHERE id::text = $1 OR reference_legale_ban = $1
           FOR UPDATE`,
          [banId],
        );
        if (found.rows.length === 0) {
          await client.query("ROLLBACK");
          throw oppositionError("Ban introuvable.", 404);
        }

        const ban = found.rows[0];
        if (
          ban.statut_ban === "OPPOSITION_ENREGISTREE" ||
          !["EN_COURS_AFFICHAGE", "EXPIRANT_SOUS_48H"].includes(ban.statut_ban) ||
          ban.periode_non_commencee ||
          ban.periode_expiree
        ) {
          await client.query("ROLLBACK");
          throw oppositionError("La période légale d’opposition est close.", 409);
        }

        const dateSaisine = new Date().toISOString();
        const evidence = JSON.stringify({
          banId: ban.id,
          opposantNom: oppositionData.opposantNom,
          opposantPrenom: oppositionData.opposantPrenom,
          opposantCni: oppositionData.opposantCni,
          motif: oppositionData.motifLegalOpposition,
          dateSaisine,
        });
        const hash = crypto.createHash("sha256").update(evidence).digest("hex");
        const nonce = crypto.randomBytes(16).toString("hex");
        const signature = crypto
          .createHmac("sha256", SESSION_SECRET)
          .update(`${dateSaisine}:${ban.id}:${nonce}:${hash}`)
          .digest("base64url");
        const signedToken = `${dateSaisine}.${nonce}.${signature}`;
        const inserted = await client.query(
          `INSERT INTO oppositions_bans (
             publication_ban_id, opposant_nom, opposant_prenom,
             opposant_qualite_legale, opposant_cni, opposant_telephone,
             opposant_email, opposant_adresse, motif_legal_opposition,
             horodatage_certifie_jeton, empreinte_dossier_sha256
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, date_saisine`,
          [
            ban.id,
            oppositionData.opposantNom,
            oppositionData.opposantPrenom,
            oppositionData.opposantQualiteLegale,
            oppositionData.opposantCni,
            oppositionData.opposantTelephone,
            oppositionData.opposantEmail || null,
            oppositionData.opposantAdresse,
            oppositionData.motifLegalOpposition,
            signedToken,
            hash,
          ],
        );
        await client.query(
          `UPDATE publications_bans
           SET statut_ban = 'OPPOSITION_ENREGISTREE'
           WHERE id = $1`,
          [ban.id],
        );
        await client.query("COMMIT");
        return {
          success: true,
          message: "Opposition enregistrée. Elle doit être instruite par l’autorité compétente.",
          numeroOpposition: `OPP-${new Date().getFullYear()}-${inserted.rows[0].id.slice(0, 8).toUpperCase()}`,
          horodatageCertifieSha256: hash,
          dateSaisine: inserted.rows[0].date_saisine,
        };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        if (error.statusCode) throw error;
        console.error("[PostgreSQL] Échec d’enregistrement de l’opposition:", error.message);
        throw error;
      } finally {
        client.release();
      }
    }
    if (isProduction) throw unavailableError();

    const ban = await this.findById(banId);
    if (!ban) {
      throw oppositionError("Ban introuvable.", 404);
    }
    if (
      ban.statutBan === "OPPOSITION_ENREGISTREE" ||
      !["EN_COURS_AFFICHAGE", "EXPIRANT_SOUS_48H"].includes(ban.statutBan) ||
      !isDisplayPeriodOpen(ban.dateDebutAffichage, ban.dateFinAffichage)
    ) {
      throw oppositionError("La période légale d’opposition est close.", 409);
    }

    const dateSaisine = new Date().toISOString();
    const sha256 = crypto.createHash("sha256").update(JSON.stringify({
      banId,
      ...oppositionData,
      dateSaisine,
    })).digest("hex");

    ban.statutBan = "OPPOSITION_ENREGISTREE";

    const numeroOpposition = `OPP-2026-${Date.now().toString().slice(-6)}`;
    const oppositionResult = {
      success: true,
      message:
        "Opposition enregistrée. Elle doit être instruite par l’autorité compétente.",
      numeroOpposition,
      horodatageCertifieSha256: sha256,
      dateSaisine,
    };

    return oppositionResult;
  }
}

module.exports = BanModel;
