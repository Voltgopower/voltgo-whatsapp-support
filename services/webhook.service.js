const db = require('../config/db');
const customerRepository = require('../repositories/customer.repository');
const conversationRepository = require('../repositories/conversation.repository');
const messageRepository = require('../repositories/message.repository');

function extractInboundMessages(payload) {
  const results = [];

  if (!payload || payload.object !== 'whatsapp_business_account') {
    return results;
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      if (!messages.length) continue;

      const contact = contacts[0] || null;

      for (const message of messages) {
        results.push({
          contact,
          message,
          rawValue: value,
        });
      }
    }
  }

  return results;
}

function normalizeInboundMessage({ contact, message, rawValue }) {
  const phone = message?.from || null;
  const waId = contact?.wa_id || null;
  const profileName = contact?.profile?.name || null;
  const messageType = message?.type || 'unknown';
  const whatsappMessageId = message?.id || null;

  let content = null;
  if (messageType === 'text') {
    content = message?.text?.body || null;
  }

  const createdAt = message?.timestamp
    ? new Date(Number(message.timestamp) * 1000)
    : new Date();

  return {
    phone,
    waId,
    profileName,
    messageType,
    whatsappMessageId,
    content,
    createdAt,
    rawPayload: {
      contact,
      message,
      rawValue,
    },
  };
}

function isSupportedMessageType(messageType) {
  return messageType === 'text';
}

async function processSingleInboundMessage(inbound) {
  const normalized = normalizeInboundMessage(inbound);

  if (!normalized.phone || !normalized.whatsappMessageId) {
    return {
      processed: false,
      reason: 'missing_phone_or_message_id',
      data: normalized,
    };
  }

  if (!isSupportedMessageType(normalized.messageType)) {
    return {
      processed: false,
      reason: 'unsupported_message_type',
      data: normalized,
    };
  }

  const existingMessage = await messageRepository.findByWhatsappMessageId(
    normalized.whatsappMessageId
  );

  if (existingMessage) {
    return {
      processed: false,
      reason: 'duplicate_message',
      data: existingMessage,
    };
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    let customer = await client.query(
      `
      SELECT *
      FROM customers
      WHERE phone = $1
      LIMIT 1
      `,
      [normalized.phone]
    );
    customer = customer.rows[0] || null;

    if (!customer) {
      const createdCustomer = await client.query(
        `
        INSERT INTO customers (
          phone,
          profile_name,
          wa_id,
          last_message_at
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          normalized.phone,
          normalized.profileName,
          normalized.waId,
          normalized.createdAt,
        ]
      );
      customer = createdCustomer.rows[0];
    } else {
      const updatedCustomer = await client.query(
        `
        UPDATE customers
        SET
          profile_name = COALESCE($2, profile_name),
          wa_id = COALESCE($3, wa_id),
          last_message_at = $4
        WHERE id = $1
        RETURNING *
        `,
        [
          customer.id,
          normalized.profileName,
          normalized.waId,
          normalized.createdAt,
        ]
      );
      customer = updatedCustomer.rows[0];
    }

    let conversation = await client.query(
      `
      SELECT *
      FROM conversations
      WHERE customer_id = $1
        AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [customer.id]
    );
    conversation = conversation.rows[0] || null;

    if (!conversation) {
      const createdConversation = await client.query(
        `
        INSERT INTO conversations (
          customer_id,
          status,
          last_message_at,
          unread_count
        )
        VALUES ($1, 'open', $2, 0)
        RETURNING *
        `,
        [customer.id, normalized.createdAt]
      );
      conversation = createdConversation.rows[0];
    }

    const insertedMessage = await client.query(
      `
      INSERT INTO messages (
        conversation_id,
        customer_id,
        direction,
        message_type,
        content,
        whatsapp_message_id,
        status,
        raw_payload,
        created_at
      )
      VALUES ($1, $2, 'inbound', $3, $4, $5, 'received', $6, $7)
      RETURNING *
      `,
      [
        conversation.id,
        customer.id,
        normalized.messageType,
        normalized.content,
        normalized.whatsappMessageId,
        JSON.stringify(normalized.rawPayload),
        normalized.createdAt,
      ]
    );

    const messageRecord = insertedMessage.rows[0];

    const updatedConversation = await client.query(
      `
      UPDATE conversations
      SET
        last_message_id = $2,
        last_message_at = $3,
        unread_count = unread_count + 1
      WHERE id = $1
      RETURNING *
      `,
      [conversation.id, messageRecord.id, normalized.createdAt]
    );

    await client.query('COMMIT');

    return {
      processed: true,
      reason: 'ok',
      data: {
        customer,
        conversation: updatedConversation.rows[0],
        message: messageRecord,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function processWebhookPayload(payload) {
  const inboundMessages = extractInboundMessages(payload);
  const results = [];

  for (const inbound of inboundMessages) {
    const result = await processSingleInboundMessage(inbound);
    results.push(result);
  }

  return {
    total: inboundMessages.length,
    results,
  };
}

module.exports = {
  extractInboundMessages,
  normalizeInboundMessage,
  processSingleInboundMessage,
  processWebhookPayload,
};