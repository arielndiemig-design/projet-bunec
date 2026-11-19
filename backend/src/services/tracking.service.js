const crypto = require("node:crypto");
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
    return {
      ...dossier,
      demandeur: {
        ...dossier.demandeur,
        nomComplet: "Identité protégée",
        telephone: maskPhone(dossier.demandeur?.telephone),
        cni: maskIdentifier(dossier.demandeur?.cni),
        email: maskEmail(dossier.demandeur?.email),
      },
      titulaire: "Identité protégée",
      motifRejet: null,
      donneesActeCivil: null,
      bat: {
        ...(dossier.bat || {}),
        available: false,
        document: null,
      },
      cycleDeVie: dossier.cycleDeVie
        ? {
            ...dossier.cycleDeVie,
            motifBlocage: null,
            etapes: (dossier.cycleDeVie.etapes || []).map((etape) => ({
              ...etape,
              acteur: "Service d’état civil",
              description: "Progression enregistrée par le centre d’état civil.",
            })),
          }
        : dossier.cycleDeVie,
    };
  }

  static async verifyOtp({ dossierId, otp, email }) {
    const dId = String(dossierId || "").trim();
    const code = String(otp || "").trim();
    const emailTarget = normalizeEmail(email || "");

    const verificationEntry = dId ? otpVerificationStore.get(dId) : null;

    if (
      !dId ||
      !code ||
      !verificationEntry ||
      verificationEntry.dossierId !== dId ||
      (emailTarget && verificationEntry.email !== emailTarget)
    ) {
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

    verificationEntry.attempts = (verificationEntry.attempts || 0) + 1;
    const expectedCode = Buffer.from(String(verificationEntry.otp || ""));
    const providedCode = Buffer.from(code);
    if (
      expectedCode.length !== providedCode.length ||
      !crypto.timingSafeEqual(expectedCode, providedCode)
    ) {
      if (verificationEntry.attempts >= 5) {
        otpVerificationStore.delete(verificationEntry.dossierId);
      }
      const error = new Error("Code OTP invalide ou expiré.");
      error.statusCode = 401;
      throw error;
    }

    const dossier = dossiersHistoriqueDatabase.find(
      (item) => item.id === verificationEntry.dossierId,
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

function maskPhone(value) {
  const phone = String(value || "");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone ? "••••" : null;
  return `${digits.slice(0, 2)}••••${digits.slice(-2)}`;
}

function maskIdentifier(value) {
  const identifier = String(value || "");
  if (!identifier) return null;
  if (identifier.length <= 4) return "••••";
  return `${identifier.slice(0, 2)}••••${identifier.slice(-2)}`;
}

function maskEmail(value) {
  const email = String(value || "");
  const [name, domain] = email.split("@");
  if (!name || !domain) return null;
  return `${name.slice(0, 1)}•••@${domain}`;
}

module.exports = TrackingService;
