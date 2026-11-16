function stripSensitiveText(value) {
  return String(value || "")
    .replace(/[\r\n<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

function maskPhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `${digits.slice(0, 2)} •• •• ${digits.slice(-2)}`;
}

function maskIdentifier(id) {
  const str = String(id || "");
  if (str.length <= 4) return "••••";
  return `${str.slice(0, 2)}••••${str.slice(-2)}`;
}

const allowedActTypes = new Set([
  "ACTE_NAISSANCE",
  "ACTE_MARIAGE",
  "ACTE_DECES",
  "DECLARATION_TARDIVE_JUGEMENT_SUPPLETIF",
]);

function validateTrackingSearch(req, res, next) {
  const { regionId, communeId, typeActe, criterion } = req.body || {};

  if (!regionId || !communeId || !typeActe || !criterion) {
    return res.status(400).json({
      success: false,
      error: "Le centre, le type d’acte et une information d’identification sont obligatoires.",
    });
  }

  if (!allowedActTypes.has(typeActe)) {
    return res.status(400).json({
      success: false,
      error: "Le type d’acte sélectionné est invalide.",
    });
  }

  req.sanitizedSearch = {
    regionId: stripSensitiveText(regionId),
    communeId: stripSensitiveText(communeId),
    typeActe: stripSensitiveText(typeActe),
    criterion: stripSensitiveText(criterion),
  };

  next();
}

module.exports = {
  stripSensitiveText,
  maskPhoneNumber,
  maskIdentifier,
  allowedActTypes,
  validateTrackingSearch,
};
