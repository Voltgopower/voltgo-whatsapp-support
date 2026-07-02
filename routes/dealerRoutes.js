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

router.get("/:id", dealerController.getDealerById);

router.get("/:id/dashboard", dealerController.getDealerDashboard);

module.exports = router;