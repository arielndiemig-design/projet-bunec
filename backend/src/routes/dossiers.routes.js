const express = require("express");
const DossiersController = require("../controllers/dossiers.controller");
const { validateTrackingSearch } = require("../middlewares/validation.middleware");

const router = express.Router();

router.post("/dossiers/suivi", validateTrackingSearch, DossiersController.search);
router.post("/dossiers/suivi/verification", DossiersController.verify);

module.exports = router;
