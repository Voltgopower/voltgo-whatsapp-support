const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhook.controller");

console.log("webhook.routes.js loaded");
console.log("verifyWebhook type =", typeof webhookController.verifyWebhook);
console.log("receiveWebhook type =", typeof webhookController.receiveWebhook);

router.get("/", webhookController.verifyWebhook);
router.post("/", webhookController.receiveWebhook);

module.exports = router;