const { territorialData } = require("../data/store");
const { query, isDatabaseConfigured } = require("../config/database");

class ReferentielModel {
  static async getTerritorialHierarchy() {
    if (isDatabaseConfigured()) {
      try {
        const regionsRes = await query(
          "SELECT id, code, nom, chef_lieu FROM regions WHERE actif = true ORDER BY nom;",
        );
        const communesRes = await query(
          "SELECT id, region_id, nom, code_commune FROM communes WHERE actif = true ORDER BY nom;",
        );

        if (regionsRes.rows.length > 0) {
          const communesByRegion = new Map();
          for (const com of communesRes.rows) {
            if (!communesByRegion.has(com.region_id)) {
              communesByRegion.set(com.region_id, []);
            }
            communesByRegion.get(com.region_id).push(com);
          }

          return regionsRes.rows.map((reg) => ({
            id: reg.id,
            nom: reg.nom,
            chefLieu: reg.chef_lieu,
            communes: communesByRegion.get(reg.id) || [],
          }));
        }
      } catch (err) {
        console.warn("[PostgreSQL] Erreur lecture référentiel, repli en mémoire:", err.message);
      }
    }

    return territorialData;
  }
}

module.exports = ReferentielModel;
