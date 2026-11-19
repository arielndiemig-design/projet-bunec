const path = require("node:path");
const crypto = require("node:crypto");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error("PORT doit être un numéro de port valide (0-65535).");
}

function deriveAdminPasswordHash(password, salt) {
  return crypto
    .pbkdf2Sync(
      String(password || ""),
      String(salt || ""),
      220000,
      32,
      "sha256",
    )
    .toString("hex");
}

const SESSION_SECRET =
  process.env.BUNEC_SESSION_SECRET ||
  (isProduction ? null : crypto.randomBytes(32).toString("hex"));

const ADMIN_USERNAME = process.env.BUNEC_ADMIN_USERNAME || "bunec";
const ADMIN_PASSWORD_SALT = process.env.BUNEC_ADMIN_PASSWORD_SALT || null;
const ADMIN_PASSWORD_HASH = process.env.BUNEC_ADMIN_PASSWORD_HASH || null;

if (
  isProduction &&
  (!SESSION_SECRET || Buffer.byteLength(SESSION_SECRET) < 32)
) {
  throw new Error(
    "BUNEC_SESSION_SECRET doit contenir au moins 32 octets aléatoires en production.",
  );
}
if (
  isProduction &&
  (!ADMIN_PASSWORD_SALT ||
    Buffer.byteLength(ADMIN_PASSWORD_SALT) < 16 ||
    !/^[a-f0-9]{64}$/i.test(ADMIN_PASSWORD_HASH || ""))
) {
  throw new Error(
    "BUNEC_ADMIN_PASSWORD_HASH (64 caractères hexadécimaux) et un sel d’au moins 16 octets sont requis en production.",
  );
}

const DATABASE_URL = process.env.DATABASE_URL || "";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : ["http://localhost:5173"];

const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY_HOPS || 0);

if (
  !Number.isInteger(RATE_LIMIT_MAX_REQUESTS) ||
  RATE_LIMIT_MAX_REQUESTS < 1 ||
  !Number.isFinite(RATE_LIMIT_WINDOW_MS) ||
  RATE_LIMIT_WINDOW_MS < 1000
) {
  throw new Error("Les paramètres de limitation des requêtes sont invalides.");
}
if (
  !Number.isInteger(TRUST_PROXY_HOPS) ||
  TRUST_PROXY_HOPS < 0 ||
  TRUST_PROXY_HOPS > 10
) {
  throw new Error("TRUST_PROXY_HOPS doit être un entier compris entre 0 et 10.");
}

module.exports = {
  NODE_ENV,
  isProduction,
  PORT,
  DATABASE_URL,
  SESSION_SECRET,
  ADMIN_USERNAME,
  ADMIN_PASSWORD_SALT,
  ADMIN_PASSWORD_HASH,
  ALLOWED_ORIGINS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  TRUST_PROXY_HOPS,
  deriveAdminPasswordHash,
};
