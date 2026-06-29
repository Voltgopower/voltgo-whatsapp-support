const express = require("express");

const router = express.Router();
const dealerController = require("../controllers/dealerController");

// =========================
// Dealers
// =========================

router.get("/", dealerController.getDealers);

router.get("/:id", dealerController.getDealerById);

router.get("/:id/dashboard", dealerController.getDealerDashboard);

module.exports = router;