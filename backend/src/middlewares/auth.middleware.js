const crypto = require("node:crypto");
const { SESSION_SECRET, isProduction, ADMIN_USERNAME } = require("../config/env");
const { query, isDatabaseConfigured } = require("../config/database");

const SESSION_COOKIE_NAME = "bunec_session";
const SESSION_TTL_MS = 15 * 60 * 1000;
const activeSessions = new Map();

function parseCookies(headerValue = "") {
  const cookies = {};
  for (const item of String(headerValue).split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (!key || rest.length === 0) continue;
    try {
      cookies[key] = decodeURIComponent(rest.join("="));
    } catch {
      continue;
    }
  }
  return cookies;
}

function issueSession(username) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({
      u: username,
      exp: expiresAt,
      sid: crypto.randomUUID(),
      csrf: crypto.randomBytes(24).toString("hex"),
    }),
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
  const [payloadBase64, signature, ...rest] = token.split(".");
  if (!payloadBase64 || !signature || rest.length > 0) return null;
  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadBase64)
    .digest("base64url");

  const actualSignature = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    actualSignature.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualSignature, expectedBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
    if (
      typeof data.u !== "string" ||
      typeof data.sid !== "string" ||
      typeof data.csrf !== "string" ||
      !Number.isFinite(data.exp) ||
      Date.now() > data.exp
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

async function registerSession(session) {
  if (!session?.sid || !Number.isFinite(session.exp)) {
    throw new Error("Session administrateur invalide.");
  }
  if (isDatabaseConfigured()) {
    await query("DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP");
    await query(
      `INSERT INTO admin_sessions (id, username, expires_at)
       VALUES ($1, $2, $3)`,
      [session.sid, session.u, new Date(session.exp)],
    );
    return;
  }
  if (isProduction) {
    const error = new Error("Le registre de sessions PostgreSQL est indisponible.");
    error.statusCode = 503;
    throw error;
  }

  const now = Date.now();
  for (const [sid, expiresAt] of activeSessions) {
    if (expiresAt <= now) activeSessions.delete(sid);
  }
  if (activeSessions.size >= 10000) {
    const error = new Error("Trop de sessions administrateur actives.");
    error.statusCode = 503;
    throw error;
  }
  activeSessions.set(session.sid, session.exp);
}

async function revokeSession(session) {
  if (!session?.sid) return;
  if (isDatabaseConfigured()) {
    await query("DELETE FROM admin_sessions WHERE id = $1", [session.sid]);
    return;
  }
  activeSessions.delete(session.sid);
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

  if (isProduction && !isDatabaseConfigured()) {
    return res.status(503).json({
      success: false,
      error: "Le registre de sessions est indisponible.",
    });
  }

  const active = isDatabaseConfigured()
    ? query(
        `SELECT 1 FROM admin_sessions
         WHERE id = $1 AND username = $2 AND expires_at > CURRENT_TIMESTAMP`,
        [session.sid, session.u],
      ).then((result) => result.rowCount > 0)
    : Promise.resolve((activeSessions.get(session.sid) || 0) > Date.now());

  active
    .then((isActive) => {
      if (!isActive) {
        return res.status(401).json({
          success: false,
          error: "Session expirée ou non authentifiée.",
        });
      }
      req.session = session;
      next();
    })
    .catch(next);
}

function requireAdmin(req, res, next) {
  const u = String(req.session?.u || "").toLowerCase();
  const allowed = u === String(ADMIN_USERNAME).toLowerCase();

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
  registerSession,
  revokeSession,
  setSessionCookie,
  clearSessionCookie,
  requireSession,
  requireAdmin,
};
