const { isProduction } = require("../config/env");

const CSRF_COOKIE_NAME = "bunec_csrf";

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

function clearCsrfCookie(res) {
  const flags = [
    `${CSRF_COOKIE_NAME}=`,
    "Path=/",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (isProduction) flags.push("Secure");
  appendCookie(res, flags.join("; "));
}

function ensureCsrf(req, res, next) {
  const tokenHeader =
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"] ||
    req.body?._csrf;

  const expectedToken = req.session?.csrf;

  if (!tokenHeader || !expectedToken || tokenHeader !== expectedToken) {
    return res.status(403).json({
      success: false,
      error: "Jeton CSRF manquant ou invalide.",
    });
  }

  next();
}

module.exports = {
  setCsrfCookie,
  clearCsrfCookie,
  ensureCsrf,
};
