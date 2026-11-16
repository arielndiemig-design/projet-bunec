function notFoundHandler(req, res) {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({
      success: false,
      error: "Route API introuvable.",
    });
  }
  return res.status(404).json({
    success: false,
    error: "Ressource introuvable.",
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) {
    console.error("[Erreur Serveur]", err);
  }

  res.status(statusCode).json({
    success: false,
    error:
      statusCode >= 500
        ? "Erreur interne du serveur."
        : err.message || "Requête invalide.",
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
