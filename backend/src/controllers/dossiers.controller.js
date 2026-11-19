const TrackingService = require("../services/tracking.service");

class DossiersController {
  static async search(req, res, next) {
    try {
      const criteria = req.sanitizedSearch;
      const dossier = await TrackingService.searchDossier(criteria);
      res.status(200).json({
        success: true,
        found: true,
        dossier,
      });
    } catch (err) {
      next(err);
    }
  }

  static async verify(req, res, next) {
    try {
      const { dossierId, otp, email } = req.body || {};
      if (
        typeof dossierId !== "string" ||
        typeof otp !== "string" ||
        (email !== undefined && typeof email !== "string")
      ) {
        return res.status(400).json({
          success: false,
          error: "Les informations de vérification sont invalides.",
        });
      }
      const dossier = await TrackingService.verifyOtp({ dossierId, otp, email });
      res.status(200).json({
        success: true,
        verified: true,
        dossier,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DossiersController;
