const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversation.controller");

router.get("/", conversationController.listConversations);
router.get("/:id/messages", conversationController.getMessagesByConversationId);

router.patch("/:id/status", conversationController.updateConversationStatus);
router.patch("/:id/assign", conversationController.assignConversation);
router.patch("/:id/read", conversationController.markConversationRead);

module.exports = router;