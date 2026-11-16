const http = require("node:http");
const { PORT } = require("./src/config/env");
const { createApp } = require("./src/app");
const { closeDatabase } = require("./src/config/database");

async function startServer() {
  const app = createApp();
  const httpServer = http.createServer(app);

  httpServer.on("close", () => {
    closeDatabase().catch((error) => console.error("[BUNEC] Erreur fermeture DB:", error));
  });

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(PORT, "0.0.0.0", resolve);
  });

  const address = httpServer.address();
  console.log(`[BUNEC API MVC] Serveur actif sur http://localhost:${address.port}`);
  return httpServer;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("[BUNEC] Impossible de démarrer le serveur :", error);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
