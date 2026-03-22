const db = require('../config/db');

let cachedMessageTextColumn = null;

async function getMessageTextColumn() {
  if (cachedMessageTextColumn) return cachedMessageTextColumn;

  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
  `;

  const { rows } = await db.query(sql);
  const columns = rows.map((row) => row.column_name);

  const candidates = ['text', 'body', 'message_text', 'content'];
  const found = candidates.find((name) => columns.includes(name));

  cachedMessageTextColumn = found || null;
  return cachedMessageTextColumn;
}

async function findById(id) {
  const messageTextColumn = await getMessageTextColumn();

  const lastMessagePreviewSelect = messageTextColumn
    ? `m.${messageTextColumn} AS last_message_preview`
    : `NULL AS last_message_preview`;

  const sql = `
    SELECT
      c.*,
      cu.phone,
      cu.profile_name,
      cu.notes,
      ${lastMessagePreviewSelect},
      COALESCE(
        json_agg(DISTINCT ct.tag) FILTER (WHERE ct.tag IS NOT NULL),
        '[]'
      ) AS tags
    FROM conversations c
    LEFT JOIN customers cu ON c.customer_id = cu.id
    LEFT JOIN messages m ON c.last_message_id = m.id
    LEFT JOIN customer_tags ct ON c.customer_id = ct.customer_id
    WHERE c.id = $1
    GROUP BY c.id, cu.id, m.id
    LIMIT 1
  `;

  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function getAllConversations() {
  const messageTextColumn = await getMessageTextColumn();

  const lastMessagePreviewSelect = messageTextColumn
    ? `m.${messageTextColumn} AS last_message_preview`
    : `NULL AS last_message_preview`;

  const sql = `
    SELECT
      c.*,
      cu.phone,
      cu.profile_name,
      cu.notes,
      ${lastMessagePreviewSelect},
      COALESCE(
        json_agg(DISTINCT ct.tag) FILTER (WHERE ct.tag IS NOT NULL),
        '[]'
      ) AS tags
    FROM conversations c
    LEFT JOIN customers cu ON c.customer_id = cu.id
    LEFT JOIN messages m ON c.last_message_id = m.id
    LEFT JOIN customer_tags ct ON c.customer_id = ct.customer_id
    GROUP BY c.id, cu.id, m.id
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
  `;

  const { rows } = await db.query(sql);
  return rows;
}

async function assignConversation({ conversationId, assignedTo }) {
  const sql = `
    UPDATE conversations
    SET
      assigned_to = $2,
      assigned_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(sql, [conversationId, assignedTo]);
  return rows[0] || null;
}

async function unassignConversation({ conversationId }) {
  const sql = `
    UPDATE conversations
    SET
      assigned_to = NULL,
      assigned_at = NULL,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(sql, [conversationId]);
  return rows[0] || null;
}

async function updateConversationAfterOutbound({
  conversationId,
  lastMessageId,
  lastMessageAt,
}) {
  const sql = `
    UPDATE conversations
    SET
      last_message_id = $2,
      last_message_at = $3,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(sql, [
    conversationId,
    lastMessageId,
    lastMessageAt,
  ]);

  return rows[0] || null;
}

module.exports = {
  findById,
  getAllConversations,
  assignConversation,
  unassignConversation,
  updateConversationAfterOutbound,
};