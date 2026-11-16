// Re-export et enrichissement du magasin de données BUNEC
const originalStore = require("../../data/store");

module.exports = {
  ...originalStore,
};
