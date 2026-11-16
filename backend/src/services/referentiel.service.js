const ReferentielModel = require("../models/referentiel.model");

class ReferentielService {
  static async getReferentiel() {
    return ReferentielModel.getTerritorialHierarchy();
  }
}

module.exports = ReferentielService;
