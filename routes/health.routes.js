const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", async (req, res) => {
  try {
    // 1️⃣ 检查数据库
    await db.query("SELECT 1");

    return res.json({
      success: true,
      service: "voltgo-whatsapp-crm-api",
      status: "ok",
      db: "connected",
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Health check error:", err.message);

    return res.status(500).json({
      success: false,
      service: "voltgo-whatsapp-crm-api",
      status: "error",
      db: "disconnected",
      error: err.message,
      time: new Date().toISOString(),
    });
  }
});

module.exports = router;