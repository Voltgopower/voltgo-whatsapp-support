const webhookService = require('../services/webhook.service');

/*
Verify webhook (Meta verification)
*/
async function verifyWebhook(req, res) {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('verifyWebhook called');

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      return res.status(200).send(challenge);
    }

    console.log('Webhook verification failed');
    return res.sendStatus(403);
  } catch (error) {
    console.error('verifyWebhook error:', error);
    return res.status(500).send('Webhook verification failed');
  }
}

/*
Receive webhook (incoming messages)
*/
async function receiveWebhook(req, res) {
  try {
    console.log('====== WEBHOOK RECEIVED ======');
    console.log(JSON.stringify(req.body, null, 2));

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