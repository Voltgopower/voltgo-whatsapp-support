const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const dealerController = require("../controllers/dealerController");

// =========================
// Dealers
// =========================

router.get("/", authMiddleware, dealerController.getDealers);

router.post("/", authMiddleware, dealerController.createDealer);

router.put("/:id", authMiddleware, dealerController.updateDealer);

router.patch("/:id/status", authMiddleware, dealerController.updateDealerStatus);

router.patch("/:id/password", authMiddleware, dealerController.resetDealerPassword);

module.exports = router;