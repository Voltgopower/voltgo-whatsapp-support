const db = require('../config/db');

async function findByPhone(phone) {
  const sql = `
    SELECT *
    FROM customers
    WHERE phone = $1
    LIMIT 1
  `;
  const { rows } = await db.query(sql, [phone]);
  return rows[0] || null;
}

async function createCustomer({ phone, profileName, waId, lastMessageAt }) {
  const sql = `
    INSERT INTO customers (
      phone,
      profile_name,
      wa_id,
      last_message_at
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const values = [phone, profileName, waId, lastMessageAt];
  const { rows } = await db.query(sql, values);
  return rows[0];
}

async function updateLastMessageAt(customerId, lastMessageAt) {
  const sql = `
    UPDATE customers
    SET last_message_at = $2
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [customerId, lastMessageAt]);
  return rows[0] || null;
}

async function updateProfile(customerId, { profileName, waId }) {
  const sql = `
    UPDATE customers
    SET
      profile_name = COALESCE($2, profile_name),
      wa_id = COALESCE($3, wa_id)
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [customerId, profileName, waId]);
  return rows[0] || null;
}

module.exports = {
  findByPhone,
  createCustomer,
  updateLastMessageAt,
  updateProfile,
};