const express = require("express");
const DossiersController = require("../controllers/dossiers.controller");
const { validateTrackingSearch } = require("../middlewares/validation.middleware");
const { createRateLimiter } = require("../middlewares/security.middleware");

const router = express.Router();

router.post(
  "/dossiers/suivi",
  createRateLimiter({ limit: 30, windowMs: 15 * 60 * 1000 }),
  validateTrackingSearch,
  DossiersController.search,
);
router.post(
  "/dossiers/suivi/verification",
  createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 }),
  DossiersController.verify,
);

module.exports = router;
