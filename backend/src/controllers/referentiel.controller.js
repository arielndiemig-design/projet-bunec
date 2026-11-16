const ReferentielService = require("../services/referentiel.service");

class ReferentielController {
  static async getReferentiel(req, res, next) {
    try {
      const data = await ReferentielService.getReferentiel();
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ReferentielController;
