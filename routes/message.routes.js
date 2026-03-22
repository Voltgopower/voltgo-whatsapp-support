const express = require("express");
const router = express.Router();
const controller = require("../controllers/message.controller");

console.log("=== message.routes.js loaded ===");

router.post("/", (req, res, next) => {
  console.log("=== POST /api/messages matched ===");
  next();
}, controller.sendMessage);

router.post("/send", (req, res, next) => {
  console.log("=== POST /api/messages/send matched ===");
  next();
}, controller.sendMessage);

router.post("/send-media", controller.createMediaMessage);
router.get("/:conversationId", controller.getMessagesByConversation);
router.post("/:id/retry", controller.retryMessage);
router.patch("/:id/dismiss-failed", controller.dismissFailedMessage);
router.delete("/:id", controller.deleteFailedMessage);

module.exports = router;