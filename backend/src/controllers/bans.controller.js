const BansService = require("../services/bans.service");

class BansController {
  static async list(req, res, next) {
    try {
      const filters = {
        region: req.query.region,
        commune: req.query.commune,
        statut: req.query.statut,
        regime: req.query.regime,
        q: req.query.q,
      };
      const bans = await BansService.getAllBans(filters);
      res.status(200).json(bans);
    } catch (err) {
      next(err);
    }
  }

  static async createOpposition(req, res, next) {
    try {
      const { banId } = req.params;
      const result = await BansService.submitOpposition(banId, req.body || {});
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = BansController;
