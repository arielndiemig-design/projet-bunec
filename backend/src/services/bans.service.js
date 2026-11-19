const BanModel = require("../models/ban.model");
const { stripSensitiveText } = require("../middlewares/validation.middleware");

const legalQualities = new Set([
  "CONJOINT_NON_DIVORCE",
  "ASCENDANT",
  "TUTEUR",
  "MINISTERE_PUBLIC",
]);

class BansService {
  static async getAllBans(filters = {}) {
    let bans = await BanModel.findAll();

    if (filters.region && filters.region !== "ALL") {
      bans = bans.filter((b) => b.regionId === filters.region);
    }
    if (filters.commune && filters.commune !== "ALL") {
      bans = bans.filter((b) => b.communeId === filters.commune);
    }
    if (filters.statut && filters.statut !== "ALL") {
      bans = bans.filter((b) => b.statutBan === filters.statut);
    }
    if (filters.regime && filters.regime !== "ALL") {
      bans = bans.filter((b) => b.regimeMatrimonial === filters.regime);
    }
    if (filters.q) {
      const q = String(filters.q).toLowerCase().trim();
      bans = bans.filter(
        (b) =>
          b.referenceLegaleBan.toLowerCase().includes(q) ||
          b.epoux.nom.toLowerCase().includes(q) ||
          b.epoux.prenom.toLowerCase().includes(q) ||
          b.epouse.nom.toLowerCase().includes(q) ||
          b.epouse.prenom.toLowerCase().includes(q) ||
          b.communeNom.toLowerCase().includes(q),
      );
    }

    return bans;
  }

  static async submitOpposition(banId, payload) {
    if (!banId) {
      const error = new Error("Identifiant du ban requis.");
      error.statusCode = 400;
      throw error;
    }

    const requiredFields = [
      "opposantNom",
      "opposantPrenom",
      "opposantCni",
      "opposantTelephone",
      "opposantAdresse",
      "motifLegalOpposition",
    ];
    if (
      requiredFields.some(
        (field) => typeof payload[field] !== "string" || !payload[field].trim(),
      )
    ) {
      const error = new Error("Les informations de l’opposant et le motif légal sont obligatoires.");
      error.statusCode = 400;
      throw error;
    }

    if (!legalQualities.has(payload.opposantQualiteLegale)) {
      const error = new Error("La qualité légale de l’opposant est invalide.");
      error.statusCode = 400;
      throw error;
    }

    const clean = {
      opposantNom: stripSensitiveText(payload.opposantNom),
      opposantPrenom: stripSensitiveText(payload.opposantPrenom),
      opposantQualiteLegale: payload.opposantQualiteLegale,
      opposantCni: stripSensitiveText(payload.opposantCni),
      opposantTelephone: stripSensitiveText(payload.opposantTelephone),
      opposantEmail: stripSensitiveText(payload.opposantEmail || ""),
      opposantAdresse: stripSensitiveText(payload.opposantAdresse),
      motifLegalOpposition: stripSensitiveText(payload.motifLegalOpposition),
    };
    if (
      clean.opposantNom.length > 150 ||
      clean.opposantPrenom.length > 150 ||
      clean.opposantCni.length > 50 ||
      clean.opposantTelephone.length > 30 ||
      clean.opposantEmail.length > 150 ||
      clean.opposantAdresse.length > 255 ||
      clean.motifLegalOpposition.length < 10
    ) {
      const error = new Error("Certaines informations sont trop longues ou incomplètes.");
      error.statusCode = 400;
      throw error;
    }
    if (
      !/^[0-9+(). -]{8,30}$/.test(clean.opposantTelephone) ||
      (clean.opposantEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.opposantEmail))
    ) {
      const error = new Error("Le téléphone ou l’adresse électronique est invalide.");
      error.statusCode = 400;
      throw error;
    }

    return BanModel.addOpposition(banId, clean);
  }
}

module.exports = BansService;
