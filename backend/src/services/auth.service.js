const crypto = require("node:crypto");
const {
  ADMIN_USERNAME,
  ADMIN_PASSWORD_SALT,
  ADMIN_PASSWORD_HASH,
  deriveAdminPasswordHash,
} = require("../config/env");
const {
  issueSession,
  setSessionCookie,
  clearSessionCookie,
  verifySession,
  registerSession,
  revokeSession,
} = require("../middlewares/auth.middleware");
const {
  setCsrfCookie,
  clearCsrfCookie,
} = require("../middlewares/csrf.middleware");
const {
  maskPhoneNumber,
  maskIdentifier,
} = require("../middlewares/validation.middleware");
const DossierModel = require("../models/dossier.model");

const loginAttemptStore = new Map();

class AuthService {
  static validateAdminCredentials(username, password) {
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !ADMIN_PASSWORD_SALT ||
      !/^[a-f0-9]{64}$/i.test(ADMIN_PASSWORD_HASH || "")
    ) {
      return false;
    }
    if (username !== ADMIN_USERNAME) return false;

    const actualHash = Buffer.from(
      deriveAdminPasswordHash(password, ADMIN_PASSWORD_SALT),
      "hex",
    );
    const expectedHash = Buffer.from(ADMIN_PASSWORD_HASH, "hex");
    return (
      actualHash.length === expectedHash.length &&
      crypto.timingSafeEqual(actualHash, expectedHash)
    );
  }

  static async login(req, res, { username, password }) {
    if (!ADMIN_PASSWORD_SALT || !ADMIN_PASSWORD_HASH) {
      const error = new Error("L’authentification administrateur n’est pas configurée.");
      error.statusCode = 503;
      throw error;
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const attempts = loginAttemptStore.get(ip) || { count: 0, firstSeen: Date.now() };

    if (Date.now() - attempts.firstSeen > 15 * 60 * 1000) {
      attempts.count = 0;
      attempts.firstSeen = Date.now();
    }

    const isValid = this.validateAdminCredentials(username, password);

    if (!isValid) {
      if (!loginAttemptStore.has(ip) && loginAttemptStore.size >= 10000) {
        const now = Date.now();
        for (const [key, value] of loginAttemptStore) {
          if (now - value.firstSeen > 15 * 60 * 1000) loginAttemptStore.delete(key);
        }
        if (loginAttemptStore.size >= 10000) {
          const error = new Error("Trop de tentatives. Réessayez plus tard.");
          error.statusCode = 429;
          throw error;
        }
      }
      attempts.count += 1;
      loginAttemptStore.set(ip, attempts);
      if (attempts.count >= 5) {
        const error = new Error("Trop de tentatives. Réessayez plus tard.");
        error.statusCode = 429;
        throw error;
      }
      const error = new Error("Identifiant ou mot de passe invalide.");
      error.statusCode = 401;
      throw error;
    }

    loginAttemptStore.delete(ip);

    const sessionUser = ADMIN_USERNAME;
    const sessionToken = issueSession(sessionUser);
    const session = verifySession(sessionToken);
    await registerSession(session);

    setSessionCookie(res, sessionToken);
    setCsrfCookie(res, session.csrf);

    return {
      success: true,
      message: "Authentification réussie. Bienvenue sur l’Espace Admin BUNEC.",
      user: {
        username: sessionUser,
        role: "SUPER_ADMIN_BUNEC",
        nomComplet: "Officier Supérieur Central BUNEC",
        direction: "Direction Générale - Inspection & Registre National",
      },
      csrfToken: session.csrf,
    };
  }

  static async logout(req, res) {
    await revokeSession(req.session);
    clearSessionCookie(res);
    clearCsrfCookie(res);
    return { success: true, message: "Déconnexion réussie." };
  }

  static async getAdminHistorique() {
    const dossiers = await DossierModel.getAllHistorique();

    return {
      success: true,
      total: dossiers.length,
      derniereMiseAJour: new Date().toISOString(),
      dossiers: dossiers.map((d) => ({
        ...d,
        demandeur: {
          ...d.demandeur,
          telephone: maskPhoneNumber(d.demandeur?.telephone),
          cni: maskIdentifier(d.demandeur?.cni),
          email: maskEmail(d.demandeur?.email),
        },
        provenance: {
          ...d.provenance,
          adresseIp: d.provenance?.adresseIp ? "***" : null,
        },
      })),
    };
  }

  static async updateDossierStatut(dossierId, nouveauStatut, motif, actor) {
    const item = await DossierModel.updateStatut(
      dossierId,
      nouveauStatut,
      motif,
      actor,
    );
    if (!item) {
      const error = new Error("Dossier introuvable.");
      error.statusCode = 404;
      throw error;
    }

    return {
      success: true,
      message: "Statut mis à jour avec succès.",
      dossier: item,
    };
  }
}

function maskEmail(value) {
  const email = String(value || "");
  const [name, domain] = email.split("@");
  if (!name || !domain) return null;
  return `${name.slice(0, 1)}•••@${domain}`;
}

module.exports = AuthService;
