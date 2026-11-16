const express = require("express");
const ReferentielController = require("../controllers/referentiel.controller");

const router = express.Router();

router.get("/referentiel/cameroun", ReferentielController.getReferentiel);

module.exports = router;
