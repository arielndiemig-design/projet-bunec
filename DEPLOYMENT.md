# Guide de Déploiement et d'Exploitation : Plateforme BUNEC (Suivi de Dossier)

Ce document décrit l'architecture, l'installation locale, le démarrage et le déploiement en production de l'application **« SUIVI DE DOSSIER » (BUNEC)**, réorganisée en deux entités strictement séparées :
- **Backend** : API HTTP Express sous architecture MVC (Routes, Contrôleurs, Services, Modèles, Middlewares) avec support PostgreSQL et résilience.
- **Frontend** : Interface utilisateur dédiée respectant une parité visuelle et comportementale absolue (zéro altération d'interface).

---

## 1. Architecture du Système

```text
SUIVI DE DOSSIER/
├── backend/                             # API HTTP MVC (Port 3000)
│   ├── server.js                        # Point d'entrée serveur HTTP
│   ├── app.js                           # Relais vers src/app.js
│   ├── test-api.js                      # Tests automatisés complets des routes API
│   ├── src/
│   │   ├── app.js                       # Express, compression, CORS, en-têtes sécurité
│   │   ├── config/
│   │   │   ├── env.js                   # Variables d'environnement centralisées
│   │   │   └── database.js              # Pool PostgreSQL (pg) avec résilience
│   │   ├── middlewares/
│   │   │   ├── security.middleware.js   # En-têtes HTTP, CORS, Rate Limiter
│   │   │   ├── auth.middleware.js       # Session signée HMAC-SHA256, cookies sécurisés
│   │   │   ├── csrf.middleware.js       # Jeton CSRF (Double Submit Cookie)
│   │   │   ├── validation.middleware.js # Validation entrées et masquage PII
│   │   │   └── error.middleware.js      # Gestionnaire d'erreurs uniforme
│   │   ├── routes/
│   │   │   ├── index.js                 # Agrégateur API v1
│   │   │   ├── health.routes.js         # GET /api/v1/health
│   │   │   ├── referentiel.routes.js    # GET /api/v1/referentiel/cameroun
│   │   │   ├── dossiers.routes.js       # POST /api/v1/dossiers/suivi & /verification
│   │   │   ├── bans.routes.js           # GET /api/v1/bans & POST /oppositions
│   │   │   └── admin.routes.js          # POST /auth/admin, GET /admin/historique, POST /statut
│   │   ├── controllers/
│   │   │   ├── health.controller.js
│   │   │   ├── referentiel.controller.js
│   │   │   ├── dossiers.controller.js
│   │   │   ├── bans.controller.js
│   │   │   └── admin.controller.js
│   │   ├── services/
│   │   │   ├── tracking.service.js
│   │   │   ├── bans.service.js
│   │   │   ├── referentiel.service.js
│   │   │   └── auth.service.js
│   │   ├── models/
│   │   │   ├── dossier.model.js
│   │   │   ├── ban.model.js
│   │   │   └── referentiel.model.js
│   │   └── data/
│   │       └── store.js                 # Données de référence et repli en mémoire
│   ├── database/
│   │   ├── schema.sql                   # Schéma DDL relationnel (Loi 2011/011)
│   │   └── seeds/                       # Données initiales des 10 régions du Cameroun
│   └── .env                             # Configuration locale backend
│
├── frontend/                            # Interface Utilisateur Web (Port 5173)
│   ├── index.html                       # Shell HTML institutionnel
│   ├── partials/                        # 10 composants HTML modulaires
│   ├── src/
│   │   ├── main.js                      # Logique interactive connectée à l'API
│   │   ├── styles.css                   # Styles officiels et impression @media print
│   │   └── tailwind.config.js           # Palette Cameroun & Police Administrative
│   ├── images/                          # Armoiries, Logo BUNEC, photos des bans
│   └── vite.config.js                   # Proxy /api vers le backend Express
└── README.md
```

---

## 2. Prérequis Système

- **Node.js** : Version 18 ou plus récente (testé avec Node.js v24).
- **PostgreSQL** : Version 15+ (recommandé pour la persistance complète).
- **Navigateur moderne** : Chrome, Firefox, Safari ou Edge.

---

## 3. Installation et Configuration

### 3.1 Cloner le dépôt et configurer le Backend
```bash
cd backend
npm install
cp .env.example .env
```

Vérifiez le contenu de `backend/.env` :
```ini
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=postgresql://bunec:bunec123@127.0.0.1:5432/bunec
BUNEC_SESSION_SECRET=dev-bunec-session-secret-change-me
BUNEC_ADMIN_USERNAME=bunec
BUNEC_ADMIN_PASSWORD_SALT=77f5f46d495a269a4cd7998d5ce18220
BUNEC_ADMIN_PASSWORD_HASH=e52c8f91b97a38167d028a1e5baf8442a11ad1873a3c26c62846a80c1cbb8077
```

### 3.2 Configuration de la Base de Données PostgreSQL (Optionnelle en Dev, Requise en Prod)
En développement, si PostgreSQL n'est pas encore démarré, le backend bascule automatiquement sur les données de référence en mémoire sans planter.

Pour initialiser PostgreSQL :
```bash
sudo -u postgres psql
CREATE ROLE bunec WITH LOGIN PASSWORD 'bunec123';
CREATE DATABASE bunec OWNER bunec;
\q

psql "postgresql://bunec:bunec123@127.0.0.1:5432/bunec" -f backend/database/schema.sql
psql "postgresql://bunec:bunec123@127.0.0.1:5432/bunec" -f backend/database/seeds/seed_regions_communes.sql
```

---

## 4. Démarrage et Tests

### 4.1 Lancer les tests automatisés de l'API MVC
```bash
cd backend
npm test
```
Tous les 9 tests doivent afficher `✓` :
- `GET /api/v1/health`
- `GET /api/v1/referentiel/cameroun`
- `POST /api/v1/dossiers/suivi`
- `GET /api/v1/bans`
- `POST /api/v1/bans/:banId/oppositions`
- `POST /api/v1/auth/admin`
- `GET /api/v1/admin/historique`
- `POST /api/v1/admin/dossiers/:id/statut`

### 4.2 Démarrage en Développement

Ouvrez deux terminaux séparés :

**Terminal 1 (Backend API) :**
```bash
cd backend
npm run dev
# L'API démarre sur http://localhost:3000
```

**Terminal 2 (Frontend) :**
```bash
cd frontend
npm run dev
# L'interface web démarre sur http://localhost:5173
```

Ouvrez votre navigateur sur : **`http://localhost:5173`**

---

## 5. Parcours Utilisateur et Accès

1. **Charte de Confidentialité** : S'affiche lors du premier accès (sauvegarde dans `localStorage`).
2. **Suivi de Mon Dossier** :
   - Sélection du Centre d'État Civil avec auto-complétion parmi plus de 360 centres.
   - Choix du type d'acte (Naissance, Mariage, Décès, Jugement supplétif).
   - Recherche exacte par numéro de récépissé (ex: `12019/CE101/N/0731`) ou identifiant BUNEC (ex: `CMR-2019-CE-BOK-NAI-000731`).
3. **Publication des Bans** :
   - Consultation des projets de mariage officiels.
   - Filtrage réactif par Région, Commune, Statut et Régime matrimonial.
   - Saisine d'opposition formelle certifiée SHA-256 transmise directement au backend.
4. **Bon à Tirer (BAT)** :
   - Consultation au format officiel conforme Loi 2011/011.
   - Téléchargement et impression PDF A4 optimisée (`window.print()`).
5. **Espace Administration** :
   - Accessible par double-clic sur le logo BUNEC dans l'en-tête (ou bouton dédié).
   - Identifiant : `bunec`
   - Mot de passe : `333669`
   - Permet de basculer en direct le statut d'un dossier (`PRÊT POUR RETRAIT` / `EN INSTRUCTION`) et d'exporter le Rapport National d'Audit au format PDF A4.

---

## 6. Mise en Production avec Reverse Proxy Nginx

En production, un reverse proxy Nginx est placé devant le frontend et le backend :

```nginx
server {
    listen 80;
    server_name suivi.bunec.cm;

    # Frontend statique construit ou SSR
    location / {
        root /home/bunec/Bureau/SUIVIE\ DE\ DOSSIER/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API Backend MVC
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

La commande de build du frontend :
```bash
cd frontend && npm run build
```
Génère le dossier `dist/` prêt à être servi par Nginx.
Le backend est démarré avec un gestionnaire de processus comme PM2 ou systemd :
```bash
cd backend && npm start
```
