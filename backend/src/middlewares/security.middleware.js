const {
  ALLOWED_ORIGINS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  isProduction,
} = require("../config/env");

const rateLimitStore = new Map();

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function checkRateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  let entry = rateLimitStore.get(ip);
  if (!entry && rateLimitStore.size >= 10000) {
    for (const [key, value] of rateLimitStore) {
      if (now - value.firstSeen > RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(key);
    }
    if (rateLimitStore.size >= 10000) {
      res.status(429).json({
        success: false,
        error: "Trop de requêtes. Veuillez patienter avant de réessayer.",
      });
      return true;
    }
  }
  entry ||= { count: 0, firstSeen: now };

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
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({
      success: false,
      error: "Origine non autorisée.",
    });
  }
  if (origin) {
    res.setHeader("Vary", "Origin");
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
  res.setHeader("Cache-Control", "no-store");
  if (isProduction) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (checkRateLimit(req, res)) {
    return;
  }

  next();
}

function createRateLimiter({ limit, windowMs }) {
  const requestsByIp = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const ip = getClientIp(req);
    let entry = requestsByIp.get(ip);
    if (!entry && requestsByIp.size >= 10000) {
      for (const [key, value] of requestsByIp) {
        if (now - value.firstSeen >= windowMs) requestsByIp.delete(key);
      }
      if (requestsByIp.size >= 10000) {
        return res.status(429).json({
          success: false,
          error: "Trop de requêtes. Veuillez patienter avant de réessayer.",
        });
      }
    }
    if (!entry || now - entry.firstSeen >= windowMs) {
      entry = { count: 0, firstSeen: now };
      requestsByIp.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > limit) {
      return res.status(429).json({
        success: false,
        error: "Trop de requêtes. Veuillez patienter avant de réessayer.",
      });
    }
    next();
  };
}

function requireAllowedOrigin(req, res, next) {
  if (!req.headers.origin || !ALLOWED_ORIGINS.includes(req.headers.origin)) {
    return res.status(403).json({
      success: false,
      error: "Origine non autorisée.",
    });
  }
  next();
}

module.exports = {
  setSecurityHeaders,
  getClientIp,
  createRateLimiter,
  requireAllowedOrigin,
};
