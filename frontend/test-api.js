const crypto = require("node:crypto");
const http = require("node:http");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "";
process.env.PGHOST = "";
process.env.PGDATABASE = "";
process.env.PGUSER = "";
process.env.PGPASSWORD = "";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";
process.env.BUNEC_SESSION_SECRET = "test-session-secret-not-for-deployment";
process.env.BUNEC_ADMIN_USERNAME = "test-admin";
process.env.BUNEC_ADMIN_PASSWORD_SALT = "test-only-salt";
const testAdminPassword = "test-only-password";
process.env.BUNEC_ADMIN_PASSWORD_HASH = crypto
  .pbkdf2Sync(testAdminPassword, process.env.BUNEC_ADMIN_PASSWORD_SALT, 220000, 32, "sha256")
  .toString("hex");

const { createApp } = require("../backend/src/app");

async function runTests() {
  console.log("=== Lancement des tests de l'API MVC BUNEC ===");
  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name} :`, err.message);
      failed++;
    }
  }

  try {
    // 1. Health check
    await test("GET /api/v1/health", async () => {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      const json = await res.json();
      if (!("success" in json) || !("database" in json)) {
        throw new Error("Format de réponse invalide");
      }
    });

    // 2. Referentiel
    await test("GET /api/v1/referentiel/cameroun", async () => {
      const res = await fetch(`${baseUrl}/api/v1/referentiel/cameroun`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json) || json.length < 10) {
        throw new Error("Référentiel incomplet (attendu >= 10 régions)");
      }
    });

    // 3. Suivi citoyen - cas trouvé
    await test("POST /api/v1/dossiers/suivi (Recherche exacte)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/dossiers/suivi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: "CE",
          communeId: "CE-BOKI",
          typeActe: "ACTE_NAISSANCE",
          criterion: "CMR-2019-CE-BOK-NAI-000731",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.dossier) throw new Error("Dossier non renvoyé");
      if (json.dossier.demandeur.nomComplet !== "Identité protégée") {
        throw new Error("Les données personnelles ne sont pas masquées");
      }
    });

    // 4. Recherche par téléphone refusée
    await test("POST /api/v1/dossiers/suivi (Téléphone refusé)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/dossiers/suivi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: "CE",
          communeId: "CE-BOKI",
          typeActe: "ACTE_NAISSANCE",
          criterion: "699112233",
        }),
      });
      if (res.status !== 400) throw new Error(`Attendu 400, reçu ${res.status}`);
    });

    // 5. Suivi citoyen - cas 404
    await test("POST /api/v1/dossiers/suivi (Inexistant -> 404)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/dossiers/suivi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: "CE",
          communeId: "CE-BOKI",
          typeActe: "ACTE_NAISSANCE",
          criterion: "DOSSIER-INEXISTANT-9999",
        }),
      });
      if (res.status !== 404) throw new Error(`Attendu 404, reçu ${res.status}`);
    });

    // 6. Listing des bans
    let firstBanId = null;
    await test("GET /api/v1/bans", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bans`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json) || json.length === 0) throw new Error("Aucun ban renvoyé");
      const openBan = json.find(
        (ban) =>
          ["EN_COURS_AFFICHAGE", "EXPIRANT_SOUS_48H"].includes(ban.statutBan) &&
          new Date(ban.dateFinAffichage).getTime() >= Date.now(),
      );
      if (!openBan) throw new Error("Aucun ban de test en période d’opposition");
      firstBanId = openBan.id;
    });

    // 7. Opposition ban
    await test("POST /api/v1/bans/:banId/oppositions", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bans/${firstBanId}/oppositions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          opposantNom: "MBARGA",
          opposantPrenom: "Joseph",
          opposantCni: "109283746",
          opposantTelephone: "699112233",
          opposantEmail: "j.mbarga@example.com",
          opposantAdresse: "Bastos, Yaoundé",
          opposantQualiteLegale: "ASCENDANT",
          motifLegalOpposition: "Mariage antérieur non dissous",
        }),
      });
      if (res.status !== 201) throw new Error(`Attendu 201, reçu ${res.status}`);
      const json = await res.json();
      if (!json.horodatageCertifieSha256) throw new Error("Empreinte SHA-256 manquante");
    });

    await test("POST opposition en double (409)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bans/${firstBanId}/oppositions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          opposantNom: "MBARGA",
          opposantPrenom: "Joseph",
          opposantCni: "109283746",
          opposantTelephone: "699112233",
          opposantEmail: "j.mbarga@example.com",
          opposantAdresse: "Bastos, Yaoundé",
          opposantQualiteLegale: "ASCENDANT",
          motifLegalOpposition: "Mariage antérieur non dissous",
        }),
      });
      if (res.status !== 409) throw new Error(`Attendu 409, reçu ${res.status}`);
    });

    await test("POST opposition depuis une origine interdite (403)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bans/${firstBanId}/oppositions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://example.invalid",
        },
        body: "{}",
      });
      if (res.status !== 403) throw new Error(`Attendu 403, reçu ${res.status}`);
    });

    // 8. Connexion admin
    let sessionCookie = null;
    let csrfToken = null;
    await test("POST /api/v1/auth/admin (Mot de passe invalide refusé)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "bunec", password: "invalid-password" }),
      });
      if (res.status !== 401) throw new Error(`Attendu 401, reçu ${res.status}`);
    });

    await test("POST /api/v1/auth/admin (Login)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "test-admin",
          password: testAdminPassword,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.csrfToken) throw new Error("Jeton CSRF manquant");
      csrfToken = data.csrfToken;
      if (typeof res.headers.getSetCookie === "function") {
        sessionCookie = res.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; ");
      } else {
        const raw = res.headers.get("set-cookie") || "";
        sessionCookie = raw.split(",").map((c) => c.split(";")[0].trim()).join("; ");
      }
    });

    // 9. Historique admin
    let firstDossierId = null;
    await test("GET /api/v1/admin/historique", async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/historique`, {
        headers: { Cookie: sessionCookie },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !Array.isArray(data.dossiers)) {
        throw new Error("Historique dossiers invalide");
      }
      firstDossierId = data.dossiers[0].id;
    });

    // 10. Mise à jour statut admin avec CSRF
    await test("POST /api/v1/admin/dossiers/:id/statut (CSRF)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/dossiers/${firstDossierId}/statut`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          nouveauStatut: "PRETE_RETRAIT",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error("Échec mise à jour");
    });

    await test("POST statut admin invalide (400)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/dossiers/${firstDossierId}/statut`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ nouveauStatut: "STATUT_INCONNU" }),
      });
      if (res.status !== 400) throw new Error(`Attendu 400, reçu ${res.status}`);
    });

    await test("POST déconnexion puis session révoquée", async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: sessionCookie,
          "X-CSRF-Token": csrfToken,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const history = await fetch(`${baseUrl}/api/v1/admin/historique`, {
        headers: { Cookie: sessionCookie },
      });
      if (history.status !== 401) {
        throw new Error(`Session toujours acceptée: HTTP ${history.status}`);
      }
    });

    console.log(`\n=== Résultat des tests : ${passed} réussis, ${failed} échoués ===`);
  } finally {
    server.close();
  }
}

runTests().catch(console.error);
