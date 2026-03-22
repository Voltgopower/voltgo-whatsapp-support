const db = require("../config/db");

async function getCustomerById(customerId) {
  const sql = `
    SELECT *
    FROM customers
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await db.query(sql, [customerId]);
  return rows[0] || null;
}

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

async function createCustomer({ phone, profileName }) {
  const sql = `
    INSERT INTO customers (
      phone,
      profile_name,
      notes,
      created_at
    )
    VALUES ($1, $2, '', NOW())
    RETURNING *
  `;
  const { rows } = await db.query(sql, [phone, profileName || phone]);
  return rows[0] || null;
}

async function touchCustomer(customerId, profileName) {
  const sql = `
    UPDATE customers
    SET
      profile_name = COALESCE($2, profile_name)
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [customerId, profileName || null]);
  return rows[0] || null;
}

async function updateCustomerNotes(customerId, notes) {
  const sql = `
    UPDATE customers
    SET
      notes = $2
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await db.query(sql, [customerId, notes || ""]);
  return rows[0] || null;
}

async function getCustomerTags(customerId) {
  const sql = `
    SELECT id, customer_id, tag
    FROM customer_tags
    WHERE customer_id = $1
    ORDER BY id DESC
  `;
  const { rows } = await db.query(sql, [customerId]);
  return rows;
}

async function addCustomerTag(customerId, tag) {
  const sql = `
    INSERT INTO customer_tags (customer_id, tag)
    VALUES ($1, $2)
    RETURNING *
  `;
  const { rows } = await db.query(sql, [customerId, tag]);
  return rows[0] || null;
}

// Auto Tag 专用：重复标签自动忽略
async function addTagToCustomer(customerId, tag) {
  const sql = `
    INSERT INTO customer_tags (customer_id, tag)
    VALUES ($1, $2)
    ON CONFLICT (customer_id, tag) DO NOTHING
    RETURNING *
  `;
  const { rows } = await db.query(sql, [customerId, tag]);
  return rows[0] || null;
}

async function removeCustomerTagById(customerId, tagId) {
  const sql = `
    DELETE FROM customer_tags
    WHERE customer_id = $1 AND id = $2
    RETURNING *
  `;
  const { rows } = await db.query(sql, [customerId, tagId]);
  return rows[0] || null;
}

async function removeCustomerTagByName(customerId, tag) {
  const sql = `
    DELETE FROM customer_tags
    WHERE customer_id = $1 AND tag = $2
    RETURNING *
  `;
  const { rows } = await db.query(sql, [customerId, tag]);
  return rows[0] || null;
}

module.exports = {
  getCustomerById,
  findByPhone,
  createCustomer,
  touchCustomer,
  updateCustomerNotes,
  getCustomerTags,
  addCustomerTag,
  addTagToCustomer,
  removeCustomerTagById,
  removeCustomerTagByName,
};
