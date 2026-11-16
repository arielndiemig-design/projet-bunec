# Suivi de dossier BUNEC

Portail web de consultation des publications et de suivi des dossiers d’état
civil. Le projet est séparé en deux applications indépendantes : une API
Express (`backend/`) et un frontend Vite (`frontend/`).

## Arborescence

```text
backend/                   API Express + PostgreSQL
  server.js                Point d’entrée (charge backend/.env)
  app.js                   Middleware Express et montage des routes API
  routes/api.js            Routes API
  services/                Accès aux données métier
  middleware/security.js   Sessions, CSRF, limitation et en-têtes
  data/store.js            Données en mémoire (référentiel, démonstration)
  database/pool.js         Pool PostgreSQL
   database/schema.sql      Schéma PostgreSQL
  database/seeds/          Référentiels territoriaux
  .env.example             Variables d’environnement du backend
frontend/                  Interface web (Vite)
  index.html               Shell Vite
  partials/                Sections HTML assemblées par Vite
  src/main.js              Comportements du navigateur
  src/styles.css           Styles personnalisés
  src/tailwind.config.js   Configuration Tailwind
  images/                  Images du portail
  vite.config.js           Config Vite (proxy /api vers le backend)
```

`node_modules/` et `frontend/dist/` sont exclus de Git. `backend/` et
`frontend/` possèdent chacun leur `package.json`, leur fichier de verrouillage
et leurs dépendances. Les commandes npm à la racine relaient les opérations
vers l’application concernée; l’installation des dépendances reste à faire
dans chaque dossier.

## Prérequis

- Node.js 18 ou plus récent et npm.
- PostgreSQL 15 ou plus récent pour le suivi en base.
- Un rôle PostgreSQL disposant des droits nécessaires sur le schéma BUNEC.

## Installation locale

Depuis la racine du dépôt :

```sh
(cd backend && npm install && cp .env.example .env)
(cd frontend && npm install)
```

Sur une machine Linux où PostgreSQL vient d’être installé, un administrateur
du serveur doit d’abord créer le rôle et la base. Ces commandes demandent les
droits système PostgreSQL et ne sont pas exécutées par l’application :

```sh
sudo -u postgres createuser --pwprompt bunec
sudo -u postgres createdb --owner=bunec bunec
```

Utiliser le mot de passe saisi dans `DATABASE_URL` du fichier `backend/.env`, puis
initialiser le schéma et le référentiel :

```sh
psql "$DATABASE_URL" -f backend/database/schema.sql
psql "$DATABASE_URL" -f backend/database/seeds/seed_regions_communes.sql
```

Le schéma ne crée pas les centres d’état civil ni les dossiers de production.
Ils doivent être chargés dans `centres_etat_civil` et `dossiers_suivi` avant
qu’une recherche réelle puisse aboutir.

Démarrage en développement depuis la racine, dans deux terminaux :

```sh
npm run dev             # API sur http://localhost:3000
npm run dev:frontend    # Interface sur http://localhost:5173
```

Ouvrir `http://localhost:5173`. Le serveur Vite redirige `/api` vers le backend
(`VITE_API_PROXY_TARGET`, par défaut `http://localhost:3000`). `PORT` du
backend et `ALLOWED_ORIGINS` (CORS) sont configurables dans `backend/.env`.
`npm start` démarre l’API en mode production; il ne démarre pas le serveur de
développement Vite.

## Recherche de dossier

Le formulaire envoie une seule valeur d’identification avec la région, la
commune et le type d’acte sélectionnés. Le backend compare exactement le
numéro de récépissé, l’identifiant BUNEC, le téléphone, l’email ou le nom du
demandeur, au moyen de paramètres SQL. Les correspondances partielles et les
dossiers de démonstration ne sont pas utilisés comme solution de repli.

Sans base configurée ou joignable, l’API de suivi répond `503`. Si aucun dossier
ne correspond aux critères exacts, elle répond `404`.

`GET /api/v1/health` vérifie la connexion PostgreSQL avec `SELECT 1` et répond
`200` si la base est joignable, sinon `503`.

## Mise en production

1. Installer Node.js et PostgreSQL sur le serveur. Créer la base et un rôle
   PostgreSQL dédié à l’application; éviter d’utiliser le rôle superuser.
2. Backend : installer les dépendances et créer `backend/.env` (jamais dans
   Git) à partir de `backend/.env.example` :

   ```sh
   cd backend && npm ci
   ```

   Variables minimales : `NODE_ENV=production`, `PORT`, `DATABASE_URL`,
   `ALLOWED_ORIGINS` (URL publique du frontend), `BUNEC_SESSION_SECRET`,
   `BUNEC_ADMIN_USERNAME`, `BUNEC_ADMIN_PASSWORD_SALT`,
   `BUNEC_ADMIN_PASSWORD_HASH`.

   Le hash est produit par `crypto.pbkdf2Sync(motDePasse, sel, 220000, 32,
   "sha256").toString("hex")`. En production, le serveur refuse de démarrer si
   le secret de session, le hash admin ou son sel manque.
3. Initialiser le schéma et les données de référence avec `psql`, comme dans
   la section d’installation, puis charger les centres et dossiers réels.
4. Démarrer l’API : `cd backend && npm start`.
5. Frontend : `cd frontend && npm ci && npm run build` génère `frontend/dist/`,
   à servir comme site statique (Nginx, etc.).
6. Placer un reverse proxy HTTPS devant les deux : servir `frontend/dist/` sur
   `/` et rediriger `/api` vers le backend, en transmettant
   `X-Forwarded-Proto: https`. Limiter l’accès réseau à PostgreSQL et relancer
   `npm start` du backend après un redémarrage.
7. Vérifier `https://<nom-de-domaine>/`, puis se connecter au portail admin.
   Les routes d’administration exigent la session signée et le jeton CSRF.

## État des données

Le suivi citoyen utilise PostgreSQL. Les listes de bans et l’historique admin
présents dans cette version restent des jeux de démonstration en mémoire; leurs
routes ne sont pas encore persistées dans PostgreSQL. Ne pas les considérer
comme des données de production.
