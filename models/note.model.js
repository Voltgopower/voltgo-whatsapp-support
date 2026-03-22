const db = require("../config/db");

async function listNotesByCustomerId(customerId) {
  const sql = `
    SELECT
      id,
      customer_id,
      note,
      created_by,
      created_at
    FROM customer_note_timeline
    WHERE customer_id = $1
    ORDER BY created_at DESC, id DESC
  `;
  const { rows } = await db.query(sql, [customerId]);
  return rows;
}

async function createNote({ customerId, note, createdBy }) {
  const sql = `
    INSERT INTO customer_note_timeline (
      customer_id,
      note,
      created_by
    )
    VALUES ($1, $2, $3)
    RETURNING
      id,
      customer_id,
      note,
      created_by,
      created_at
  `;
  const { rows } = await db.query(sql, [
    customerId,
    note,
    createdBy || null,
  ]);
  return rows[0] || null;
}

async function deleteNote(noteId) {
  const sql = `
    DELETE FROM customer_note_timeline
    WHERE id = $1
    RETURNING
      id,
      customer_id,
      note,
      created_by,
      created_at
  `;
  const { rows } = await db.query(sql, [noteId]);
  return rows[0] || null;
}

module.exports = {
  listNotesByCustomerId,
  createNote,
  deleteNote,
};
