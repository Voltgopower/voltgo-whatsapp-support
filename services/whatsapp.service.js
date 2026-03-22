const axios = require('axios');

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';

function getAccessToken() {
  return (
    process.env.WHATSAPP_ACCESS_TOKEN ||
    process.env.WHATSAPP_TOKEN ||
    process.env.META_ACCESS_TOKEN
  );
}

function getPhoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID;
}

async function sendTextMessage({ to, body }) {
  const token = getAccessToken();
  const phoneNumberId = getPhoneNumberId();

  console.log('=== sendTextMessage start ===');
  console.log('GRAPH_VERSION =', GRAPH_VERSION);
  console.log('WHATSAPP_PHONE_NUMBER_ID =', phoneNumberId);
  console.log('to =', to);
  console.log('body =', body);
  console.log('token exists =', !!token);

  if (!token) {
    throw new Error(
      'Missing WhatsApp access token. Set WHATSAPP_ACCESS_TOKEN or WHATSAPP_TOKEN or META_ACCESS_TOKEN in .env'
    );
  }

  if (!phoneNumberId) {
    throw new Error('Missing WHATSAPP_PHONE_NUMBER_ID in .env');
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      body,
    },
  };

  console.log('POST URL =', url);
  console.log('payload =', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });

    console.log('=== sendTextMessage success ===');
    console.log('response.status =', response.status);
    console.log('response.data =', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('=== sendTextMessage axios error ===');
    console.error('error.message =', error.message);
    console.error('error.code =', error.code);

    if (error.response) {
      console.error('error.response.status =', error.response.status);
      console.error(
        'error.response.data =',
        JSON.stringify(error.response.data, null, 2)
      );
    }

    throw error;
  }
}

module.exports = {
  sendTextMessage,
};