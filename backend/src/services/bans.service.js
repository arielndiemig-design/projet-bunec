const BanModel = require("../models/ban.model");

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

    if (!payload.opposantNom || !payload.opposantCni || !payload.motifLegalOpposition) {
      const error = new Error("Les informations de l’opposant et le motif légal sont obligatoires.");
      error.statusCode = 400;
      throw error;
    }

    return BanModel.addOpposition(banId, payload);
  }
}

module.exports = BansService;
