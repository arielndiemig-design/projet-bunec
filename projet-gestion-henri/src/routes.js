const express = require('express');
const router = express.Router();
const db = require('./db');

// Route pour récupérer toutes les communes
router.get('/communes', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM communes ORDER BY nom;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route pour voir le suivi des dossiers d'état civil
router.get('/dossiers', async (req, res) => {
  try {
    const result = await db.query('SELECT numero_recepisse, type_acte, demandeur_nom, statut_actuel FROM dossiers_suivi;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
