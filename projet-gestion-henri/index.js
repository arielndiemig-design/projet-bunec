const express = require('express');
const app = express();
const routes = require('./src/routes');

app.use(express.json());

// Intégration des routes API
app.use('/api', routes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
