const { Pool } = require("pg");
const { DATABASE_URL } = require("./env");

const hasDatabaseConfiguration = Boolean(
  DATABASE_URL ||
    (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER),
);

const pool = hasDatabaseConfiguration
  ? new Pool(
      DATABASE_URL
        ? {
            connectionString: DATABASE_URL,
            ssl:
              process.env.PGSSLMODE === "require"
                ? { rejectUnauthorized: true }
                : undefined,
          }
        : undefined,
    )
  : null;

if (pool) {
  pool.on("error", (err) => {
    console.error("[PostgreSQL] Erreur inattendue sur le pool de clients:", err.message);
  });
}

async function query(text, values) {
  if (!pool) {
    const error = new Error(
      "La base PostgreSQL n'est pas configurée. Définissez DATABASE_URL.",
    );
    error.statusCode = 503;
    throw error;
  }
  return pool.query(text, values);
}

async function checkDatabaseConnection() {
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}

module.exports = {
  pool,
  query,
  checkDatabaseConnection,
  closeDatabase,
  isDatabaseConfigured: () => Boolean(pool),
};
