const { ALLOWED_ORIGINS, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS, isProduction } = require("../config/env");

const rateLimitStore = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function checkRateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, firstSeen: now };

  if (now - entry.firstSeen > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.firstSeen = now;
  }

  entry.count += 1;
  rateLimitStore.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: "Trop de requêtes. Veuillez patienter avant de réessayer.",
    });
    return true;
  }

  return false;
}

function setSecurityHeaders(req, res, next) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || !isProduction)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-CSRF-Token, X-Requested-With",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (checkRateLimit(req, res)) {
    return;
  }

  next();
}

module.exports = {
  setSecurityHeaders,
  getClientIp,
};
