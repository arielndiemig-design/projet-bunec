const { checkDatabaseConnection } = require("../config/database");

class HealthController {
  static async getHealth(req, res, next) {
    try {
      const databaseConnected = await checkDatabaseConnection();
      res.status(databaseConnected ? 200 : 503).json({
        success: databaseConnected,
        database: databaseConnected ? "connected" : "unavailable",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = HealthController;
