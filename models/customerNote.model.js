const db = require("../config/db");

async function getNotesByCustomerId(customerId) {
  const sql = `
    SELECT *
    FROM customer_notes
    WHERE customer_id = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await db.query(sql, [customerId]);
  return rows;
}

async function createNote({ customerId, content, createdBy }) {
  const sql = `
    INSERT INTO customer_notes (
      customer_id,
      content,
      created_by
    )
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const { rows } = await db.query(sql, [
    customerId,
    content,
    createdBy,
  ]);
  return rows[0];
}

module.exports = {
  getNotesByCustomerId,
  createNote,
};
