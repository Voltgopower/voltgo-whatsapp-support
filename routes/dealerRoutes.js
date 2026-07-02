const express = require("express");

const router = express.Router();
const dealerController = require("../controllers/dealerController");
const authMiddleware = require("../middleware/auth.middleware");

// =========================
// Dealers
// =========================

router.get("/", dealerController.getDealers);

// Dealer 自己查看自己的 Dashboard
router.get(
  "/dashboard/me",
  authMiddleware,
  dealerController.getMyDashboard
);

// Admin 查看指定 Dealer Dashboard
router.get("/:id/dashboard", dealerController.getDealerDashboard);

router.get("/:id", dealerController.getDealerById);

module.exports = router;