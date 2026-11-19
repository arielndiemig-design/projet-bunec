const AuthService = require("../services/auth.service");

class AdminController {
  static async login(req, res, next) {
    try {
      const { username, password } = req.body || {};
      const result = await AuthService.login(req, res, { username, password });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      const result = await AuthService.logout(req, res);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getHistorique(req, res, next) {
    try {
      const result = await AuthService.getAdminHistorique();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateStatut(req, res, next) {
    try {
      const { dossierId } = req.params;
      const { nouveauStatut, motif } = req.body || {};
      const result = await AuthService.updateDossierStatut(
        dossierId,
        nouveauStatut,
        motif,
        req.session,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AdminController;
