const express = require("express");
const router = express.Router();
const controller = require("../controllers/template.controller");

console.log("=== template.routes.js loaded ===");

router.get("/", controller.listTemplates);

module.exports = router;