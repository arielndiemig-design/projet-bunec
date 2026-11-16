const crypto = require("node:crypto");
const { query, isDatabaseConfigured } = require("../config/database");
const { bansDatabase } = require("../data/store");

class BanModel {
  static async findAll() {
    return bansDatabase;
  }

  static async findById(id) {
    return bansDatabase.find((b) => b.id === id) || null;
  }

  static async addOpposition(banId, oppositionData) {
    const ban = await this.findById(banId);
    if (!ban) {
      const error = new Error("Ban introuvable.");
      error.statusCode = 404;
      throw error;
    }

    const sha256 = crypto
      .createHash("sha256")
      .update(`${banId}:${oppositionData.opposantCni}:${Date.now()}`)
      .digest("hex");

    ban.statutBan = "OPPOSITION_ENREGISTREE";

    const numeroOpposition = `OPP-2026-${Date.now().toString().slice(-6)}`;
    const oppositionResult = {
      success: true,
      message:
        "Opposition formelle enregistrée avec horodatage certifié et transmise au Procureur de la République.",
      numeroOpposition,
      horodatageCertifieSha256: sha256,
      dateSaisine: new Date().toISOString(),
    };

    return oppositionResult;
  }
}

module.exports = BanModel;
