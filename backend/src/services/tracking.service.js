const DossierModel = require("../models/dossier.model");
const { otpVerificationStore, normalizeEmail, dossiersHistoriqueDatabase, getDossierNotificationEmail } = require("../data/store");

class TrackingService {
  static async searchDossier(criteria) {
    const dossier = await DossierModel.findByExactCriteria(criteria);
    if (!dossier) {
      const error = new Error("Aucun dossier ne correspond exactement aux informations saisies.");
      error.statusCode = 404;
      throw error;
    }
    return dossier;
  }

  static async verifyOtp({ dossierId, otp, email }) {
    const dId = String(dossierId || "").trim();
    const code = String(otp || "").trim();
    const emailTarget = normalizeEmail(email || "");

    let verificationEntry = null;
    if (dId) {
      verificationEntry = otpVerificationStore.get(dId);
    }

    if (!verificationEntry && emailTarget) {
      verificationEntry = Array.from(otpVerificationStore.values()).find(
        (entry) => entry.email === emailTarget,
      );
    }

    if (!verificationEntry) {
      const error = new Error("Code OTP invalide ou expiré.");
      error.statusCode = 401;
      throw error;
    }

    if (Date.now() > verificationEntry.expiresAt) {
      otpVerificationStore.delete(verificationEntry.dossierId);
      const error = new Error("Code OTP invalide ou expiré.");
      error.statusCode = 401;
      throw error;
    }

    if (verificationEntry.otp !== code) {
      const error = new Error("Code OTP invalide ou expiré.");
      error.statusCode = 401;
      throw error;
    }

    const dossier = dossiersHistoriqueDatabase.find(
      (item) =>
        item.id === verificationEntry.dossierId ||
        item.identifiantBUNEC === dId,
    );

    if (!dossier) {
      const error = new Error("Dossier introuvable.");
      error.statusCode = 404;
      throw error;
    }

    otpVerificationStore.delete(verificationEntry.dossierId);

    const isPret = dossier.statut === "PRETE_RETRAIT";
    const isRejet = dossier.statut === "REJETEE";
    const codeCouleur = isPret ? "green" : isRejet ? "red" : "amber";

    return {
      id: dossier.id,
      bunecTrackingId: dossier.identifiantBUNEC,
      numeroRecepisse: dossier.numeroDeclaration,
      typeActe: dossier.typeActe,
      titreActe: dossier.titreActe,
      localisation: {
        region: dossier.provenance.regionNom,
        regionId: dossier.provenance.regionId,
        departement: dossier.provenance.departement,
        commune: dossier.provenance.communeNom,
        communeId: dossier.provenance.communeId,
        centre: dossier.provenance.centreEtatCivil,
        canalDepot: dossier.provenance.canalDepot,
        operateur: dossier.provenance.operateur,
      },
      demandeur: {
        nomComplet: dossier.demandeur.nomComplet,
        qualite: dossier.demandeur.qualite,
        telephone: dossier.demandeur.telephone,
        cni: dossier.demandeur.cni,
        email: getDossierNotificationEmail(dossier),
      },
      titulaire: dossier.titulaire,
      cycleDeVie: {
        etapeCourante: dossier.etapeCourante,
        codeCouleur: codeCouleur,
        statutActuel: dossier.statut,
        libelleStatut: dossier.libelleStatut,
        motifBlocage: dossier.motifRejet || null,
        etapes: [
          {
            numero: 1,
            nom: "Dossier déposé et enregistré",
            statut: "COMPLETED",
            horodatage: dossier.dateEnregistrement,
            description: `Enregistrement officiel au ${dossier.provenance.centreEtatCivil}. Identifiant BUNEC unique généré.`,
            acteur: "Guichet d'État Civil",
          },
          {
            numero: 2,
            nom: "Instruction & Vérification juridique",
            statut: isRejet ? "REJECTED" : "COMPLETED",
            horodatage: "2019-07-11T10:15:00Z",
            description: isRejet
              ? "Anomalie constatée sur les pièces justificatives."
              : "Vérification probante de régularité juridique achevée avec succès.",
            acteur: "Service Juridique & Contentieux",
          },
          {
            numero: 3,
            nom: "Validation & Signature de l'Officier",
            statut: isRejet ? "PENDING" : "COMPLETED",
            horodatage: isRejet ? null : "2019-07-11T11:30:00Z",
            description: isRejet
              ? "Signature suspendue pour non-conformité matérielle."
              : `Signé électroniquement par ${dossier.donneesActeCivil ? dossier.donneesActeCivil.certification?.officierNom || "l'Officier" : "l'Officier d'État Civil"}. Inscription au registre.`,
            acteur: "Officier d'État Civil",
          },
          {
            numero: 4,
            nom: "Disponible au guichet / Prêt pour délivrance",
            statut: isPret ? "COMPLETED" : "PENDING",
            horodatage: isPret ? dossier.dateNotification : null,
            description: isPret
              ? "Disponible au guichet municipal. Bon à Tirer (BAT) émis et consultable."
              : "En attente de délivrance.",
            convocation: isPret
              ? `Retrait ouvert dès à présent au ${dossier.lieuRetrait}`
              : null,
          },
        ],
      },
      donneesActeCivil: dossier.donneesActeCivil || null,
      bat: {
        dossierId: dossier.id,
        available: isPret && Boolean(dossier.donneesActeCivil),
        document: isPret ? dossier.donneesActeCivil || null : null,
      },
      derniereMiseAJour: new Date().toISOString(),
    };
  }
}

module.exports = TrackingService;
