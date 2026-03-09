const webhookService = require('../services/webhook.service');

async function verifyWebhook(req, res) {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (!mode || !token) {
      return res.status(400).json({
        success: false,
        message: 'Missing webhook verification params',
      });
    }

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).json({
      success: false,
      message: 'Invalid verify token',
    });
  } catch (error) {
    console.error('verifyWebhook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook verification failed',
    });
  }
}

async function receiveWebhook(req, res) {
  try {
    const payload = req.body;

    const result = await webhookService.processWebhookPayload(payload);

    return res.status(200).json({
      success: true,
      message: 'Webhook received',
      data: result,
    });
  } catch (error) {
    console.error('receiveWebhook error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error.message,
    });
  }
}

module.exports = {
  verifyWebhook,
  receiveWebhook,
};