const crypto = require("node:crypto");
const { isProduction } = require("../config/env");

const CSRF_COOKIE_NAME = "bunec_csrf";
const csrfTokens = new Map();

function issueCsrfToken() {
  return crypto.randomBytes(24).toString("hex");
}

function appendCookie(res, cookieStr) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", [cookieStr]);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieStr]);
  } else {
    res.setHeader("Set-Cookie", [existing, cookieStr]);
  }
}

function setCsrfCookie(res, token) {
  const flags = [
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "SameSite=Strict",
    "Max-Age=900",
  ];
  if (isProduction) flags.push("Secure");
  appendCookie(res, flags.join("; "));
}

function ensureCsrf(req, res, next) {
  const tokenHeader =
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"] ||
    req.body?._csrf;

  const username = req.session?.u;
  const expectedToken = username ? csrfTokens.get(username) : null;

  if (!tokenHeader || !expectedToken || tokenHeader !== expectedToken) {
    return res.status(403).json({
      success: false,
      error: "Jeton CSRF manquant ou invalide.",
    });
  }

  next();
}

module.exports = {
  csrfTokens,
  issueCsrfToken,
  setCsrfCookie,
  ensureCsrf,
};
