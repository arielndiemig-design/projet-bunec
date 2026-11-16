const crypto = require("node:crypto");
const { SESSION_SECRET, isProduction, ADMIN_USERNAME } = require("../config/env");

const SESSION_COOKIE_NAME = "bunec_session";
const SESSION_TTL_MS = 15 * 60 * 1000;

function parseCookies(headerValue = "") {
  return String(headerValue)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const [key, ...rest] = item.split("=");
      accumulator[key] = decodeURIComponent(rest.join("="));
      return accumulator;
    }, {});
}

function issueSession(username) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: expiresAt }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [payloadBase64, signature] = token.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadBase64)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
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

function setSessionCookie(res, token) {
  const flags = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isProduction) flags.push("Secure");
  appendCookie(res, flags.join("; "));
}

function clearSessionCookie(res) {
  const flags = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (isProduction) flags.push("Secure");
  appendCookie(res, flags.join("; "));
}

function requireSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  const session = verifySession(sessionToken);

  if (!session) {
    return res.status(401).json({
      success: false,
      error: "Session expirée ou non authentifiée.",
    });
  }

  req.session = session;
  next();
}

function requireAdmin(req, res, next) {
  const u = String(req.session?.u || "").toLowerCase();
  const allowed =
    u === String(ADMIN_USERNAME).toLowerCase() ||
    u === "bunec" ||
    u === "admin";

  if (!req.session || !allowed) {
    return res.status(403).json({
      success: false,
      error: "Accès interdit : privilèges insuffisants.",
    });
  }
  next();
}

module.exports = {
  parseCookies,
  issueSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  requireSession,
  requireAdmin,
};
