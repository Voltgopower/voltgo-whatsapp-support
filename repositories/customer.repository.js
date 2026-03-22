const db = require("../config/db");

async function findCustomerById(customerId) {
  const sql = `
    SELECT *
    FROM customers
    WHERE id = $1
    LIMIT 1
  `;

  const { rows } = await db.query(sql, [customerId]);
  return rows[0] || null;
}

async function updateCustomerNotes(customerId, notes) {
  const sql = `
    UPDATE customers
    SET notes = $2
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(sql, [customerId, notes]);
  return rows[0] || null;
}

async function getCustomerTags(customerId) {
  const sql = `
    SELECT tag
    FROM customer_tags
    WHERE customer_id = $1
    ORDER BY created_at ASC, id ASC
  `;

  const { rows } = await db.query(sql, [customerId]);
  return rows.map((row) => row.tag);
}

async function addCustomerTag(customerId, tag) {
  const normalizedTag = String(tag || "").trim();
  if (!normalizedTag) return null;

  const sql = `
    INSERT INTO customer_tags (customer_id, tag)
    VALUES ($1, $2)
    ON CONFLICT (customer_id, tag) DO NOTHING
    RETURNING *
  `;

  const { rows } = await db.query(sql, [customerId, normalizedTag]);
  return rows[0] || null;
}

async function deleteCustomerTag(customerId, tag) {
  const normalizedTag = String(tag || "").trim();
  if (!normalizedTag) return null;

  const sql = `
    DELETE FROM customer_tags
    WHERE customer_id = $1
      AND tag = $2
    RETURNING *
  `;

  const { rows } = await db.query(sql, [customerId, normalizedTag]);
  return rows[0] || null;
}

module.exports = {
  findCustomerById,
  updateCustomerNotes,
  getCustomerTags,
  addCustomerTag,
  deleteCustomerTag,
};