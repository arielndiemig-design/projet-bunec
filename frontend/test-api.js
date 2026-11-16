const { createApp } = require("./src/app");
const http = require("node:http");

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
    });

    // 4. Suivi citoyen - cas 404
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

    // 5. Listing des bans
    let firstBanId = null;
    await test("GET /api/v1/bans", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bans`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json) || json.length === 0) throw new Error("Aucun ban renvoyé");
      firstBanId = json[0].id;
    });

    // 6. Opposition ban
    await test("POST /api/v1/bans/:banId/oppositions", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bans/${firstBanId}/oppositions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opposantNom: "MBARGA",
          opposantPrenom: "Joseph",
          opposantCni: "109283746",
          opposantTelephone: "699112233",
          opposantEmail: "j.mbarga@example.com",
          opposantAdresse: "Bastos, Yaoundé",
          opposantQualiteLegale: "PERE",
          motifLegalOpposition: "Mariage antérieur non dissous",
        }),
      });
      if (res.status !== 201) throw new Error(`Attendu 201, reçu ${res.status}`);
      const json = await res.json();
      if (!json.horodatageCertifieSha256) throw new Error("Empreinte SHA-256 manquante");
    });

    // 7. Connexion admin
    let sessionCookie = null;
    let csrfToken = null;
    await test("POST /api/v1/auth/admin (Login)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "bunec",
          password: "333669",
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

    // 8. Historique admin
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

    // 9. Mise à jour statut admin avec CSRF
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

    console.log(`\n=== Résultat des tests : ${passed} réussis, ${failed} échoués ===`);
  } finally {
    server.close();
  }
}

runTests().catch(console.error);
