# Backend et PostgreSQL

Le suivi des dossiers lit les données depuis PostgreSQL. Le serveur ne reprend
pas les dossiers de démonstration quand la base est absente ou inaccessible.

## Configuration

Copiez `.env.example` vers `.env` dans ce dossier `backend/`, puis renseignez une
adresse PostgreSQL, un rôle dédié et les secrets d’administration. L’application
ne possède plus de mot de passe administrateur par défaut : sans hash et sel
configurés, la connexion admin répond `503`.

Initialisez ensuite le schéma et le référentiel territorial :

```sh
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seeds/seed_regions_communes.sql
```

Après une mise à jour, réappliquez `database/schema.sql` : la commande crée
notamment la table `admin_sessions` nécessaire à la révocation des sessions.
Les sessions administrateur sont vérifiées dans PostgreSQL, y compris si
l’application redémarre ou utilise plusieurs instances.

Le schéma impose des centres d’état civil, les dossiers dans `dossiers_suivi`
et les publications dans `publications_bans`. Ces données doivent être chargées
par l’administrateur de la base avant que les fonctions de production puissent
les utiliser.

## Règles de recherche

Le suivi exige une région, une commune, un type d’acte et le numéro exact du
récépissé ou l’identifiant BUNEC. Les noms, téléphones et e-mails ne sont plus
des clés de recherche. La réponse publique masque l’identité, les coordonnées,
les motifs détaillés et le document civil. Le point de vérification OTP ne peut
accepter que le code lié au dossier concerné ; aucun code n’est émis tant qu’un
fournisseur SMS/e-mail n’est pas intégré.

Les bans et les historiques utilisent PostgreSQL lorsque la base est configurée.
Une opposition n’est acceptée que pendant la période d’affichage, après
validation des champs, et dossier et ban sont mis à jour dans une transaction.
L’application enregistre la déclaration mais ne vérifie pas l’identité civile
de l’opposant et ne la transmet pas automatiquement au procureur.

En développement seulement, les données de démonstration peuvent servir lorsque
PostgreSQL n’est pas configuré. En production, ces replis sont désactivés pour
les dossiers, bans et modifications administratives : l’API renvoie une erreur
plutôt que de simuler une opération ou de renvoyer des données fictives.

Les limites de requêtes sont conservées en mémoire par instance. Pour un
déploiement multi-instance, ajoutez une limitation centralisée au reverse proxy
ou un stockage partagé.

Des identifiants PostgreSQL ont déjà été présents dans d’anciens fichiers du
dépôt. Considérez-les comme compromis : changez le mot de passe du rôle et
vérifiez également l’historique Git si ce dépôt a été publié.

L’API se lance avec `npm start` dans `backend/`; le frontend Vite est un
projet distinct dans `frontend/`. Les variables `PGHOST`, `PGDATABASE`, `PGUSER` et
`PGPASSWORD` sont aussi acceptées.
