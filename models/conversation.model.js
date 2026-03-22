const db = require("../config/db");

async function listConversations({
  search = "",
  status = "all",
  agent = "",
  currentUserId = "",
  currentUserRole = "",
}) {
  const params = [];
  const where = [];

  console.log("MODEL args =", {
    search,
    status,
    agent,
    currentUserId,
    currentUserRole,
  });

  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;

    where.push(`
      (
        c.phone ILIKE $${idx}
        OR COALESCE(c.profile_name, '') ILIKE $${idx}
        OR COALESCE(lm.content, lm.text, '') ILIKE $${idx}
      )
    `);
  }

  // 非 admin 只能看自己的 + 未分配的
  if (currentUserRole && currentUserRole !== "admin") {
    if (currentUserId) {
      params.push(String(currentUserId));
      const idx = params.length;

      where.push(`
        (
          conv.assigned_to::text = $${idx}::text
          OR conv.assigned_to IS NULL
          OR conv.assigned_to = ''
        )
      `);
    } else {
      where.push(`1 = 0`);
    }
  }

  if (status === "open") {
    where.push(`conv.status = 'open'`);
  } else if (status === "closed") {
    where.push(`conv.status = 'closed'`);
  } else if (status === "unread") {
    where.push(`COALESCE(conv.unread_count, 0) > 0`);
  } else if (status === "assigned") {
    where.push(`conv.assigned_to IS NOT NULL AND conv.assigned_to <> ''`);
  } else if (status === "unassigned") {
    where.push(`conv.assigned_to IS NULL OR conv.assigned_to = ''`);
  } else if (status === "mine") {
    if (agent !== null && agent !== undefined && agent !== "") {
      params.push(String(agent));
      const idx = params.length;
      where.push(`conv.assigned_to::text = $${idx}::text`);
    } else {
      where.push(`1 = 0`);
    }
  } else if (status === "failed") {
    where.push(`
      EXISTS (
        SELECT 1
        FROM messages m2
        WHERE m2.conversation_id = conv.id
          AND m2.direction = 'outbound'
          AND m2.status = 'failed'
          AND m2.failed_dismissed = FALSE
      )
    `);
  }

  const sql = `
    SELECT
      conv.id,
      conv.customer_id,
      conv.status,
      conv.last_message_id,
      conv.last_message_at,
      conv.unread_count,
      conv.created_at,
      conv.updated_at,
      conv.assigned_to,
      conv.assigned_at,
      c.phone,
      c.profile_name,
      COALESCE(lm.content, lm.text, '') AS last_message_preview,
      u.username AS assigned_username,
      u.role AS assigned_role,
      EXISTS (
        SELECT 1
        FROM messages m3
        WHERE m3.conversation_id = conv.id
          AND m3.direction = 'outbound'
          AND m3.status = 'failed'
          AND m3.failed_dismissed = FALSE
      ) AS has_failed
    FROM conversations conv
    JOIN customers c
      ON conv.customer_id = c.id
    LEFT JOIN messages lm
      ON conv.last_message_id = lm.id
    LEFT JOIN users u
      ON conv.assigned_to = u.id::text
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY conv.last_message_at DESC NULLS LAST, conv.id DESC
  `;

  console.log("FINAL SQL =", sql);
  console.log("PARAMS =", params);

  const { rows } = await db.query(sql, params);
  return rows;
}

async function getConversationById(conversationId) {
  const sql = `
    SELECT
      conv.id,
      conv.customer_id,
      conv.status,
      conv.last_message_id,
      conv.last_message_at,
      conv.unread_count,
      conv.created_at,
      conv.updated_at,
      conv.assigned_to,
      conv.assigned_at,
      c.phone,
      c.profile_name,
      u.username AS assigned_username,
      u.role AS assigned_role,
      EXISTS (
        SELECT 1
        FROM messages m
        WHERE m.conversation_id = conv.id
          AND m.direction = 'outbound'
          AND m.status = 'failed'
          AND m.failed_dismissed = FALSE
      ) AS has_failed
    FROM conversations conv
    JOIN customers c
      ON conv.customer_id = c.id
    LEFT JOIN users u
      ON conv.assigned_to = u.id::text
    WHERE conv.id = $1
    LIMIT 1
  `;

  const { rows } = await db.query(sql, [conversationId]);
  return rows[0] || null;
}

async function getMessagesByConversationId(conversationId) {
  const sql = `
    SELECT *
    FROM messages
    WHERE conversation_id = $1
    ORDER BY id ASC
  `;

  const { rows } = await db.query(sql, [conversationId]);
  return rows;
}

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

async function createConversation({
  customerId,
  lastMessageAt,
  lastMessagePreview,
}) {
  const sql = `
    INSERT INTO conversations (
      customer_id,
      status,
      last_message_at,
      unread_count,
      created_at,
      updated_at
    )
    VALUES ($1, 'open', $2, 0, NOW(), NOW())
    RETURNING *
  `;

  const { rows } = await db.query(sql, [
    customerId,
    lastMessageAt || new Date(),
  ]);

  return rows[0] || null;
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
      unread_count = COALESCE(unread_count, 0) + 1,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(sql, [
    conversationId,
    lastMessageId,
    lastMessageAt || new Date(),
  ]);

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
    lastMessageAt || new Date(),
  ]);

  return rows[0] || null;
}

async function updateConversationStatus(conversationId, status) {
  const sql = `
    UPDATE conversations
    SET
      status = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      customer_id,
      status,
      last_message_id,
      last_message_at,
      unread_count,
      created_at,
      updated_at,
      assigned_to,
      assigned_at
  `;

  const { rows } = await db.query(sql, [conversationId, status]);
  return rows[0] || null;
}

async function assignConversation(conversationId, assignedTo) {
  const normalizedAssignedTo =
    assignedTo === null || assignedTo === undefined || assignedTo === ""
      ? null
      : String(Number(assignedTo));

  if (
    normalizedAssignedTo !== null &&
    (normalizedAssignedTo === "NaN" || normalizedAssignedTo.trim() === "")
  ) {
    throw new Error("Invalid assignedTo value");
  }

  let updateSql = "";
  let updateParams = [];

  if (normalizedAssignedTo === null) {
    updateSql = `
      UPDATE conversations
      SET
        assigned_to = NULL,
        assigned_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    updateParams = [conversationId];
  } else {
    updateSql = `
      UPDATE conversations
      SET
        assigned_to = $2,
        assigned_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    updateParams = [conversationId, normalizedAssignedTo];
  }

  const updateResult = await db.query(updateSql, updateParams);

  if (!updateResult.rows[0]) {
    return null;
  }

  const selectSql = `
    SELECT
      conv.id,
      conv.customer_id,
      conv.status,
      conv.last_message_id,
      conv.last_message_at,
      conv.unread_count,
      conv.created_at,
      conv.updated_at,
      conv.assigned_to,
      conv.assigned_at,
      u.username AS assigned_username,
      u.role AS assigned_role
    FROM conversations conv
    LEFT JOIN users u
      ON conv.assigned_to = u.id::text
    WHERE conv.id = $1
    LIMIT 1
  `;

  const { rows } = await db.query(selectSql, [conversationId]);
  return rows[0] || null;
}

/**
 * 只在当前 conversation 仍未分配时才 assign。
 * 用于防止 webhook 重复触发导致重复分配或覆盖人工分配。
 */
async function assignConversationIfUnassigned(conversationId, assignedTo) {
  const normalizedAssignedTo =
    assignedTo === null || assignedTo === undefined || assignedTo === ""
      ? null
      : String(Number(assignedTo));

  if (
    normalizedAssignedTo === null ||
    normalizedAssignedTo === "NaN" ||
    normalizedAssignedTo.trim() === ""
  ) {
    throw new Error("Invalid assignedTo value");
  }

  const updateSql = `
    UPDATE conversations
    SET
      assigned_to = $2,
      assigned_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
      AND (
        assigned_to IS NULL
        OR assigned_to = ''
      )
    RETURNING id
  `;

  const updateResult = await db.query(updateSql, [
    conversationId,
    normalizedAssignedTo,
  ]);

  // 没更新到行，说明它已经被其他流程或人工分配过了
  if (!updateResult.rows[0]) {
    return null;
  }

  const selectSql = `
    SELECT
      conv.id,
      conv.customer_id,
      conv.status,
      conv.last_message_id,
      conv.last_message_at,
      conv.unread_count,
      conv.created_at,
      conv.updated_at,
      conv.assigned_to,
      conv.assigned_at,
      u.username AS assigned_username,
      u.role AS assigned_role
    FROM conversations conv
    LEFT JOIN users u
      ON conv.assigned_to = u.id::text
    WHERE conv.id = $1
    LIMIT 1
  `;

  const { rows } = await db.query(selectSql, [conversationId]);
  return rows[0] || null;
}

async function markConversationRead(conversationId) {
  const sql = `
    UPDATE conversations
    SET
      unread_count = 0,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      customer_id,
      status,
      last_message_id,
      last_message_at,
      unread_count,
      created_at,
      updated_at,
      assigned_to,
      assigned_at
  `;

  const { rows } = await db.query(sql, [conversationId]);
  return rows[0] || null;
}

module.exports = {
  listConversations,
  getConversationById,
  getMessagesByConversationId,
  findOpenByCustomerId,
  createConversation,
  updateConversationAfterInbound,
  updateConversationAfterOutbound,
  updateConversationStatus,
  assignConversation,
  assignConversationIfUnassigned,
  markConversationRead,
};