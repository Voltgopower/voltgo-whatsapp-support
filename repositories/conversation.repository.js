const db = require('../config/db');

async function findOpenByCustomerId(customerId) {
  const sql = `
    SELECT *
    FROM conversations
    WHERE customer_id = $1
      AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const { rows } = await db.query(sql, [customerId]);
  return rows[0] || null;
}

async function createConversation({ customerId, lastMessageAt }) {
  const sql = `
    INSERT INTO conversations (
      customer_id,
      status,
      last_message_at,
      unread_count
    )
    VALUES ($1, 'open', $2, 0)
    RETURNING *
  `;
  const { rows } = await db.query(sql, [customerId, lastMessageAt]);
  return rows[0];
}

async function updateConversationAfterInbound({
  conversationId,
  lastMessageId,
  lastMessageAt,
}) {
  const sql = `
    UPDATE conversations
    SET
      last_message_id = $2,
      last_message_at = $3,
      unread_count = unread_count + 1
    WHERE id = $1
    RETURNING *
  `;
  const values = [conversationId, lastMessageId, lastMessageAt];
  const { rows } = await db.query(sql, values);
  return rows[0] || null;
}

module.exports = {
  findOpenByCustomerId,
  createConversation,
  updateConversationAfterInbound,
};