const express = require("express");
const router = express.Router();
const controller = require("../controllers/message.controller");

console.log("=== message.routes.js loaded ===");

router.post(
  "/",
  (req, res, next) => {
    console.log("=== POST /api/messages matched ===");
    next();
  },
  controller.sendMessage
);

router.post(
  "/send",
  (req, res, next) => {
    console.log("=== POST /api/messages/send matched ===");
    next();
  },
  controller.sendMessage
);

router.post(
  "/send-template",
  (req, res, next) => {
    console.log("🔥🔥🔥 POST /api/messages/send-template matched");
    next();
  },
  controller.sendTemplateMessage
);

router.post(
  "/send-media",
  (req, res, next) => {
    console.log("🔥🔥🔥 POST /api/messages/send-media matched");
    next();
  },
  controller.createMediaMessage
);

router.get("/:conversationId", controller.getMessagesByConversation);
router.post("/:id/retry", controller.retryMessage);
router.patch("/:id/dismiss-failed", controller.dismissFailedMessage);
router.delete("/:id", controller.deleteFailedMessage);

module.exports = router;