const db = require('../config/db');

async function findByWhatsappMessageId(whatsappMessageId) {
  const sql = `
    SELECT *
    FROM messages
    WHERE whatsapp_message_id = $1
    LIMIT 1
  `;
  const { rows } = await db.query(sql, [whatsappMessageId]);
  return rows[0] || null;
}

async function createMessage({
  conversationId,
  customerId,
  direction,
  messageType,
  content,
  whatsappMessageId,
  status,
  rawPayload,
  createdAt,
}) {
  const sql = `
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const values = [
    conversationId,
    customerId,
    direction,
    messageType,
    content,
    whatsappMessageId,
    status,
    rawPayload,
    createdAt,
  ];

  const { rows } = await db.query(sql, values);
  return rows[0];
}

module.exports = {
  findByWhatsappMessageId,
  createMessage,
};