const express = require("express");
const router = express.Router();
const controller = require("../controllers/template.controller");
const authMiddleware = require("../middleware/auth.middleware");

console.log("=== template.routes.js loaded ===");

router.get("/", authMiddleware, controller.listTemplates);

module.exports = router;