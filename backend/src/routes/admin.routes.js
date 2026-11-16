const express = require("express");
const AdminController = require("../controllers/admin.controller");
const { requireSession, requireAdmin } = require("../middlewares/auth.middleware");
const { ensureCsrf } = require("../middlewares/csrf.middleware");

const router = express.Router();

router.post("/auth/admin", AdminController.login);
router.post("/auth/logout", AdminController.logout);

router.get("/admin/historique", requireSession, requireAdmin, AdminController.getHistorique);
router.post(
  "/admin/dossiers/:dossierId/statut",
  requireSession,
  requireAdmin,
  ensureCsrf,
  AdminController.updateStatut,
);

module.exports = router;
