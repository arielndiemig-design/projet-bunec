const express = require("express");
const healthRoutes = require("./health.routes");
const referentielRoutes = require("./referentiel.routes");
const dossiersRoutes = require("./dossiers.routes");
const bansRoutes = require("./bans.routes");
const adminRoutes = require("./admin.routes");

const router = express.Router();

router.use("/api/v1", healthRoutes);
router.use("/api/v1", referentielRoutes);
router.use("/api/v1", dossiersRoutes);
router.use("/api/v1", bansRoutes);
router.use("/api/v1", adminRoutes);

module.exports = router;
