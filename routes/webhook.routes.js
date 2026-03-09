const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

router.get('/', webhookController.verifyWebhook);
router.post('/', webhookController.receiveWebhook);

module.exports = router;