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
  (isProduction ? null : "dev-bunec-session-secret-change-me");

const ADMIN_USERNAME = process.env.BUNEC_ADMIN_USERNAME || "bunec";
const ADMIN_PASSWORD_SALT =
  process.env.BUNEC_ADMIN_PASSWORD_SALT ||
  (isProduction ? null : "bunec-admin-dev-salt");
const DEFAULT_ADMIN_PASSWORD =
  process.env.BUNEC_ADMIN_PASSWORD || (isProduction ? null : "333669");
const ADMIN_PASSWORD_HASH =
  process.env.BUNEC_ADMIN_PASSWORD_HASH ||
  (isProduction
    ? null
    : deriveAdminPasswordHash(DEFAULT_ADMIN_PASSWORD, ADMIN_PASSWORD_SALT));

if (isProduction && !SESSION_SECRET) {
  throw new Error("BUNEC_SESSION_SECRET doit être défini en production.");
}
if (isProduction && (!ADMIN_PASSWORD_SALT || !ADMIN_PASSWORD_HASH)) {
  throw new Error(
    "BUNEC_ADMIN_PASSWORD_HASH et BUNEC_ADMIN_PASSWORD_SALT doivent être définis en production.",
  );
}

const DATABASE_URL = process.env.DATABASE_URL || "";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001"];

const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);

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
  deriveAdminPasswordHash,
};
