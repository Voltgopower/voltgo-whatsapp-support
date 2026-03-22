const db = require("../config/db");

async function createMessage({
  conversationId,
  customerId,
  waMessageId,
  phone,
  text,
  direction,
  status,
  rawPayload,
  sentAt,
}) {
  const sql = `
    INSERT INTO messages (
      conversation_id,
      customer_id,
      wa_message_id,
      whatsapp_message_id,
      phone,
      content,
      direction,
      status,
      raw_payload,
      sent_at,
      created_at,
      failed_dismissed
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      NOW(),
      FALSE
    )
    RETURNING *
  `;

  const params = [
    conversationId,
    customerId,
    waMessageId || null,   // for wa_message_id
    waMessageId || null,   // for whatsapp_message_id
    phone || null,
    text || null,
    direction || "outbound",
    status || "sending",
    rawPayload ? JSON.stringify(rawPayload) : null,
    sentAt || new Date(),
  ];

  const { rows } = await db.query(sql, params);
  return rows[0];
}

async function findByConversationId(conversationId) {
  const sql = `
    SELECT
      id,
      conversation_id,
      customer_id,
      wa_message_id,
      whatsapp_message_id,
      phone,
      COALESCE(text, content) AS text,
      content,
      direction,
      status,
      raw_payload,
      sent_at,
      created_at,
      failed_dismissed
    FROM messages
    WHERE conversation_id = $1
    ORDER BY id ASC
  `;
  const { rows } = await db.query(sql, [conversationId]);
  return rows;
}

async function getMessageById(messageId) {
  const sql = `
    SELECT *
    FROM messages
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await db.query(sql, [messageId]);
  return rows[0] || null;
}

async function findByExternalMessageId(waMessageId) {
  const sql = `
    SELECT *
    FROM messages
    WHERE wa_message_id = $1
       OR whatsapp_message_id = $1
    LIMIT 1
  `;
  const { rows } = await db.query(sql, [waMessageId]);
  return rows[0] || null;
}

async function updateStatusByWaMessageId(waMessageId, status, rawPayload) {
  const sql = `
    UPDATE messages
    SET
      status = $2,
      raw_payload = COALESCE($3, raw_payload)
    WHERE wa_message_id = $1
       OR whatsapp_message_id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [
    waMessageId,
    status,
    rawPayload ? JSON.stringify(rawPayload) : null,
  ]);
  return rows[0] || null;
}

async function markMessageSending(messageId) {
  const sql = `
    UPDATE messages
    SET
      status = 'sending',
      failed_dismissed = FALSE
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [messageId]);
  return rows[0] || null;
}

async function markMessageSent(messageId, { waMessageId, rawPayload, sentAt }) {
  const sql = `
    UPDATE messages
    SET
      status = 'sent',
      wa_message_id = COALESCE($2, wa_message_id),
      whatsapp_message_id = COALESCE($2, whatsapp_message_id),
      raw_payload = COALESCE($3, raw_payload),
      sent_at = COALESCE($4, sent_at),
      failed_dismissed = FALSE
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [
    messageId,
    waMessageId || null,
    rawPayload ? JSON.stringify(rawPayload) : null,
    sentAt || new Date(),
  ]);
  return rows[0] || null;
}

async function markMessageFailed(messageId, rawPayload) {
  const sql = `
    UPDATE messages
    SET
      status = 'failed',
      raw_payload = COALESCE($2, raw_payload),
      failed_dismissed = FALSE
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [
    messageId,
    rawPayload ? JSON.stringify(rawPayload) : null,
  ]);
  return rows[0] || null;
}

async function dismissFailedMessage(messageId) {
  const sql = `
    UPDATE messages
    SET
      failed_dismissed = TRUE
    WHERE id = $1
      AND direction = 'outbound'
      AND status = 'failed'
    RETURNING *
  `;
  const { rows } = await db.query(sql, [messageId]);
  return rows[0] || null;
}

async function deleteFailedMessage(messageId) {
  const sql = `
    DELETE FROM messages
    WHERE id = $1
      AND direction = 'outbound'
      AND status = 'failed'
    RETURNING *
  `;
  const { rows } = await db.query(sql, [messageId]);
  return rows[0] || null;
}

async function hasActiveFailedMessagesByConversationId(conversationId) {
  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM messages
      WHERE conversation_id = $1
        AND direction = 'outbound'
        AND status = 'failed'
        AND failed_dismissed = FALSE
    ) AS has_failed
  `;
  const { rows } = await db.query(sql, [conversationId]);
  return rows[0]?.has_failed || false;
}

module.exports = {
  createMessage,
  findByConversationId,
  getMessageById,
  findByExternalMessageId,
  updateStatusByWaMessageId,
  markMessageSending,
  markMessageSent,
  markMessageFailed,
  dismissFailedMessage,
  deleteFailedMessage,
  hasActiveFailedMessagesByConversationId,
};