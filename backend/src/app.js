const express = require("express");
const compression = require("compression");
const { setSecurityHeaders } = require("./middlewares/security.middleware");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");
const apiRoutes = require("./routes");
const { TRUST_PROXY_HOPS } = require("./config/env");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", TRUST_PROXY_HOPS);
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // Middlewares globaux de sécurité et CORS
  app.use(setSecurityHeaders);

  // Montage des routes API
  app.use(apiRoutes);

  // Gestion des routes inexistantes et erreurs
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
