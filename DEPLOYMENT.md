# Déploiement de l’application BUNEC

Ce guide décrit le démarrage de l’API MVC (`backend/`) et du frontend Vite
(`frontend/`). L’ancienne API `projet-gestion-henri` et l’ancien routeur
backend ne sont plus utilisés.

## 1. Prérequis

- Node.js 18 ou plus récent et npm.
- PostgreSQL 15 ou plus récent pour une utilisation en production.
- Un reverse proxy HTTPS si l’application est accessible sur Internet.

## 2. Installation locale

Depuis la racine du dépôt :

```sh
cd backend
npm ci
cp .env.example .env
```

Modifier `backend/.env` pour le développement local :

```ini
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173
TRUST_PROXY_HOPS=0
DATABASE_URL=<URL PostgreSQL locale>
BUNEC_SESSION_SECRET=<secret aléatoire d’au moins 32 octets>
BUNEC_ADMIN_USERNAME=<nom administrateur>
BUNEC_ADMIN_PASSWORD_SALT=<sel aléatoire d’au moins 16 octets>
BUNEC_ADMIN_PASSWORD_HASH=<hash PBKDF2 SHA-256 de 64 caractères hexadécimaux>
```

Le hash administrateur est calculé avec PBKDF2-SHA-256, 220 000 itérations,
32 octets de sortie et le sel indiqué. Ne mettez jamais le mot de passe en clair
dans un fichier suivi par Git. Sans hash et sel configurés, l’API refuse la
connexion administrateur.

Pour initialiser PostgreSQL avec un compte dédié :

```sh
sudo -u postgres createuser --pwprompt bunec
sudo -u postgres createdb --owner=bunec bunec
```

Renseigner `DATABASE_URL` dans l’environnement, puis appliquer le schéma et les
données territoriales :

```sh
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seeds/seed_regions_communes.sql
```

Après une mise à jour, réappliquer `database/schema.sql` pour créer les tables
ajoutées, notamment `admin_sessions`. Le schéma utilise `CREATE TABLE IF NOT
EXISTS` pour ces objets.

## 3. Tests et démarrage

Les tests API utilisent leur propre compte temporaire et des données de test :

```sh
cd backend
npm test
```

Démarrer l’API et le frontend dans deux terminaux :

```sh
cd backend && npm run dev
cd frontend && npm ci && npm run dev
```

Ouvrir `http://localhost:5173`. Vite transmet `/api` à l’API sur le port 3000.
Pour construire l’interface de production :

```sh
cd frontend && npm run build
```

## 4. Mise en production

1. Utiliser un rôle PostgreSQL dédié et limiter l’accès réseau à la base.
2. Fournir les secrets avec le gestionnaire de secrets de l’hébergeur, pas dans
   le dépôt. `NODE_ENV=production`, `DATABASE_URL`, les origines frontend exactes,
   un secret de session de 32 octets minimum, un sel aléatoire de 16 octets
   minimum et le hash administrateur sont obligatoires.
3. Configurer `ALLOWED_ORIGINS` avec les origines réellement utilisées par le
   navigateur. Ne pas élargir cette liste à toutes les origines.
4. Placer un reverse proxy HTTPS devant le frontend et l’API, remplacer les
   en-têtes `X-Forwarded-*` reçus du client et définir `TRUST_PROXY_HOPS` au
   nombre exact de proxys contrôlés. Laisser `0` si aucun proxy n’est utilisé.
5. Servir `frontend/dist/` et transmettre `/api/` au serveur Node. Garder
   PostgreSQL inaccessible depuis Internet.
6. Après installation ou mise à jour, appliquer le schéma et les graines
   territoriales, puis charger les centres, dossiers et publications réels.
7. Vérifier `/api/v1/health`, le parcours de connexion admin et les journaux
   avant d’ouvrir l’accès au public.

Les sessions administrateur sont inscrites dans PostgreSQL et révoquées à la
déconnexion. Les limites de requêtes restent en mémoire par instance ; un
déploiement multi-instance doit aussi configurer une limitation partagée au
reverse proxy ou via un stockage commun.

## 5. Limites fonctionnelles à connaître

- Le suivi public accepte uniquement un récépissé ou identifiant BUNEC exact et
  masque les données personnelles. Le BAT et les données complètes ne sont pas
  renvoyés par cette recherche.
- L’API vérifie les OTP liés à un dossier, mais aucun code n’est émis : il faut
  intégrer un fournisseur SMS ou e-mail avant d’ajouter une vérification par
  code.
- Une opposition est enregistrée en base pendant la période d’affichage, mais
  les renseignements saisis ne prouvent pas l’identité civile de l’opposant.
  Aucun document joint n’est téléversé et aucune transmission au procureur
  n’est effectuée automatiquement.
- Les mises à jour de statut et leur historique sont transactionnels. Le
  fournisseur d’envoi de notifications n’est pas intégré ; l’interface ne
  prétend donc pas qu’une notification a été envoyée.

Avant le déploiement, remplacez les identifiants qui ont déjà figuré dans
d’anciens fichiers ou exemples du dépôt. Leur suppression ne les efface pas de
l’historique Git ; s’ils ont été publiés, faites également vérifier cet
historique et révoquez les secrets compromis.
