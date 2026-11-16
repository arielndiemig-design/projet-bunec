const { query, isDatabaseConfigured } = require("../config/database");
const { dossiersHistoriqueDatabase, getDossierNotificationEmail } = require("../data/store");

const statusLabels = {
  DEPOSE: "Dossier déposé et enregistré",
  EN_INSTRUCTION: "En cours d’instruction administrative",
  VALIDATION_SIGNEE: "Validé et signé par l’Officier d’État Civil",
  PRET_DELIVRANCE: "Disponible au guichet — Prêt pour délivrance",
  REJETE_BLOQUE: "Pièce rejetée — Dossier bloqué",
};

function normalizeStatus(status) {
  if (status === "PRET_DELIVRANCE") return "PRETE_RETRAIT";
  if (status === "REJETE_BLOQUE") return "REJETEE";
  return status === "DEPOSE" ? "INSTRUCTION" : status;
}

function toTrackingRecord(row) {
  const statut = normalizeStatus(row.statut_actuel);
  const etapeCourante = Number(row.etape_cycle_vie);
  const isReady = row.statut_actuel === "PRET_DELIVRANCE";
  const isRejected = row.statut_actuel === "REJETE_BLOQUE";
  const demandeur = [row.demandeur_nom, row.demandeur_prenom]
    .filter(Boolean)
    .join(" ");
  const historyByStep = new Map(
    (row.historique || []).map((item) => [Number(item.etape), item]),
  );

  const etapes = [
    {
      numero: 1,
      nom: "Dossier déposé et enregistré",
      statut: "COMPLETED",
      horodatage: row.date_depot,
      description: `Dépôt enregistré au ${row.centre_nom}.`,
      acteur: "Centre d’État Civil",
    },
    {
      numero: 2,
      nom: "Instruction & Vérification juridique",
      statut: isRejected
        ? "REJECTED"
        : etapeCourante > 2
          ? "COMPLETED"
          : etapeCourante === 2
            ? "CURRENT"
            : "PENDING",
      description:
        row.motif_rejet_description ||
        historyByStep.get(2)?.motif ||
        "Instruction du dossier.",
      acteur: "Service d’État Civil",
    },
    {
      numero: 3,
      nom: "Validation & Signature de l’Officier",
      statut: isRejected
        ? "PENDING"
        : isReady || etapeCourante > 3
          ? "COMPLETED"
          : etapeCourante === 3
            ? "CURRENT"
            : "PENDING",
      horodatage: row.date_signature_officier,
      description:
        historyByStep.get(3)?.motif || "Validation par l’Officier d’État Civil.",
      acteur: row.officier_instructeur_nom || "Officier d’État Civil",
    },
    {
      numero: 4,
      nom: "Disponible au guichet / Prêt pour délivrance",
      statut: isReady ? "COMPLETED" : etapeCourante === 4 ? "CURRENT" : "PENDING",
      horodatage: row.date_pret_delivrance,
      description: isReady
        ? "Le dossier est disponible au guichet."
        : "En attente de délivrance.",
      convocation: isReady ? `Retrait au ${row.centre_nom}.` : null,
    },
  ].map((etape) => {
    const historique = historyByStep.get(etape.numero);
    return {
      ...etape,
      desc: etape.description,
      date: etape.horodatage
        ? new Date(etape.horodatage).toLocaleString("fr-FR")
        : historique?.date
          ? new Date(historique.date).toLocaleString("fr-FR")
          : null,
    };
  });

  return {
    id: row.id,
    source: "database",
    numeroDeclaration: row.numero_recepisse,
    identifiantBUNEC: row.bunec_tracking_id,
    typeActe: row.type_acte,
    titreActe: row.type_acte.replaceAll("_", " "),
    demandeur: {
      nomComplet: demandeur,
      telephone: row.demandeur_telephone,
      email: row.demandeur_email,
    },
    titulaire: demandeur,
    provenance: {
      regionNom: row.region_nom,
      regionId: row.region_id,
      communeNom: row.commune_nom,
      communeId: row.commune_id,
      centreEtatCivil: row.centre_nom,
    },
    dateEnregistrement: row.date_depot,
    statut,
    libelleStatut: statusLabels[row.statut_actuel] || statusLabels.EN_INSTRUCTION,
    etapeCourante,
    notificationRetraitEnvoyee: isReady,
    dateNotification: row.date_pret_delivrance,
    lieuRetrait: row.centre_nom,
    motifRejet: row.motif_rejet_description,
    donneesActeCivil: null,
    cycleDeVie: {
      etapeCourante,
      codeCouleur: isReady ? "green" : isRejected ? "red" : "amber",
      statutActuel: statut,
      libelleStatut: statusLabels[row.statut_actuel] || statusLabels.EN_INSTRUCTION,
      motifBlocage: row.motif_rejet_description
        ? {
            libelle: row.motif_rejet_code || "Dossier bloqué",
            description: row.motif_rejet_description,
          }
        : null,
      etapes,
    },
  };
}

class DossierModel {
  static async findByExactCriteria({ regionId, communeId, typeActe, criterion }) {
    if (isDatabaseConfigured()) {
      try {
        const result = await query(
          `SELECT
             d.id,
             d.bunec_tracking_id,
             d.numero_recepisse,
             d.type_acte::text AS type_acte,
             d.demandeur_nom,
             d.demandeur_prenom,
             d.demandeur_telephone,
             d.demandeur_email,
             d.statut_actuel::text AS statut_actuel,
             d.etape_cycle_vie,
             d.motif_rejet_code,
             d.motif_rejet_description,
             d.officier_instructeur_nom,
             d.date_signature_officier,
             d.date_depot,
             d.date_pret_delivrance,
             r.id AS region_id,
             r.nom AS region_nom,
             c.id AS commune_id,
             c.nom AS commune_nom,
             ce.nom AS centre_nom,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'etape', h.etape_cycle_vie,
                 'motif', h.motif_changement,
                 'date', h.created_at
               ) ORDER BY h.created_at DESC)
               FROM historique_statuts h
               WHERE h.dossier_id = d.id
             ), '[]'::jsonb) AS historique
           FROM dossiers_suivi d
           JOIN regions r ON r.id = d.region_id
           JOIN communes c ON c.id = d.commune_id
           JOIN centres_etat_civil ce ON ce.id = d.centre_id
           WHERE d.region_id = $1
             AND d.commune_id = $2
             AND d.type_acte = $3::type_acte_etat_civil
             AND (
               UPPER(BTRIM(d.numero_recepisse)) = UPPER(BTRIM($4))
               OR UPPER(BTRIM(d.bunec_tracking_id)) = UPPER(BTRIM($4))
               OR (
                 LENGTH(REGEXP_REPLACE($4, '[^0-9]', '', 'g')) >= 8
                 AND REGEXP_REPLACE(d.demandeur_telephone, '[^0-9]', '', 'g')
                   = REGEXP_REPLACE($4, '[^0-9]', '', 'g')
               )
               OR LOWER(BTRIM(CONCAT_WS(' ', d.demandeur_nom, d.demandeur_prenom)))
                 = LOWER(BTRIM($4))
               OR LOWER(BTRIM(d.demandeur_nom)) = LOWER(BTRIM($4))
               OR LOWER(BTRIM(COALESCE(d.demandeur_email, ''))) = LOWER(BTRIM($4))
             )
           LIMIT 2`,
          [regionId, communeId, typeActe, criterion],
        );

        if (result.rows.length > 1) {
          const error = new Error(
            "Plusieurs dossiers correspondent. Utilisez le numéro de récépissé ou l’identifiant BUNEC.",
          );
          error.statusCode = 409;
          throw error;
        }

        if (result.rows.length === 1) {
          return toTrackingRecord(result.rows[0]);
        }
      } catch (err) {
        if (err.statusCode === 409) throw err;
        console.warn("[PostgreSQL] Repli vers données en mémoire suite à l'erreur:", err.message);
      }
    }

    // Repli sur la base de données en mémoire
    const critUpper = String(criterion || "").trim().toUpperCase();
    const critDigits = String(criterion || "").replace(/\D/g, "");

    const found = dossiersHistoriqueDatabase.filter((d) => {
      if (regionId && d.provenance?.regionId !== regionId) return false;
      if (communeId && d.provenance?.communeId !== communeId) return false;
      if (typeActe && d.typeActe !== typeActe) return false;

      const numDecl = String(d.numeroDeclaration || "").toUpperCase();
      const idBunec = String(d.identifiantBUNEC || "").toUpperCase();
      const tel = String(d.demandeur?.telephone || "").replace(/\D/g, "");
      const nom = String(d.demandeur?.nomComplet || "").toUpperCase();
      const email = String(getDossierNotificationEmail(d) || "").toUpperCase();

      return (
        numDecl === critUpper ||
        idBunec === critUpper ||
        (critDigits.length >= 8 && tel.includes(critDigits)) ||
        nom === critUpper ||
        email === critUpper
      );
    });

    if (found.length > 1) {
      const error = new Error(
        "Plusieurs dossiers correspondent. Utilisez le numéro de récépissé ou l’identifiant BUNEC.",
      );
      error.statusCode = 409;
      throw error;
    }

    return found[0] || null;
  }

  static async findById(id) {
    return (
      dossiersHistoriqueDatabase.find(
        (d) =>
          d.id === id ||
          d.numeroDeclaration === id ||
          d.identifiantBUNEC === id,
      ) || null
    );
  }

  static async getAllHistorique() {
    return dossiersHistoriqueDatabase;
  }

  static async updateStatut(dossierId, nouveauStatut, motif = null) {
    const item = await this.findById(dossierId);
    if (!item) return null;

    item.statut = nouveauStatut || item.statut;
    if (nouveauStatut === "PRETE_RETRAIT") {
      item.libelleStatut =
        "Disponible au guichet — Prêt pour délivrance (BAT Émis)";
      item.etapeCourante = 4;
      item.notificationRetraitEnvoyee = true;
      item.dateNotification = new Date().toISOString();
      if (item.cycleDeVie) {
        item.cycleDeVie.etapeCourante = 4;
        item.cycleDeVie.statutActuel = "PRETE_RETRAIT";
        item.cycleDeVie.codeCouleur = "green";
      }
    } else if (nouveauStatut === "REJETEE") {
      item.libelleStatut = "Pièce Rejetée — Dossier Bloqué";
      item.etapeCourante = 2;
      item.motifRejet = motif || "Discordance de pièces justificatives";
      item.notificationRetraitEnvoyee = false;
      if (item.cycleDeVie) {
        item.cycleDeVie.etapeCourante = 2;
        item.cycleDeVie.statutActuel = "REJETEE";
        item.cycleDeVie.codeCouleur = "red";
      }
    } else if (nouveauStatut === "INSTRUCTION") {
      item.libelleStatut =
        "En cours d’instruction administrative (BAT Verrouillé)";
      item.etapeCourante = 2;
      item.notificationRetraitEnvoyee = false;
      if (item.cycleDeVie) {
        item.cycleDeVie.etapeCourante = 2;
        item.cycleDeVie.statutActuel = "INSTRUCTION";
        item.cycleDeVie.codeCouleur = "amber";
      }
    }

    return item;
  }
}

module.exports = DossierModel;
