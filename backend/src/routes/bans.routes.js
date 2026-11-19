const express = require("express");
const BansController = require("../controllers/bans.controller");
const {
  createRateLimiter,
  requireAllowedOrigin,
} = require("../middlewares/security.middleware");

const router = express.Router();

router.get("/bans", BansController.list);
router.post(
  "/bans/:banId/oppositions",
  requireAllowedOrigin,
  createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 }),
  BansController.createOpposition,
);

module.exports = router;
