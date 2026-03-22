const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

console.log("auth.routes.js loaded");

router.post("/login", authController.login);

// ✅ 新增
router.patch(
  "/change-password",
  authMiddleware,
  authController.changePassword
);

module.exports = router;