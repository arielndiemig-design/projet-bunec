const express = require("express");
const BansController = require("../controllers/bans.controller");

const router = express.Router();

router.get("/bans", BansController.list);
router.post("/bans/:banId/oppositions", BansController.createOpposition);

module.exports = router;
