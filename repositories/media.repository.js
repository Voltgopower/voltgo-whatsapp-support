// src/repositories/media.repository.js
const pool = require("../config/db");

async function createMediaAsset(data) {
  const query = `
    INSERT INTO media_assets (
      message_id,
      conversation_id,
      channel,
      direction,
      media_type,
      mime_type,
      original_filename,
      file_ext,
      file_size,
      storage_provider,
      bucket_name,
      object_key,
      status,
      caption,
      uploaded_by
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    )
    RETURNING *;
  `;

  const values = [
    data.message_id || null,
    data.conversation_id,
    data.channel || "whatsapp",
    data.direction,
    data.media_type,
    data.mime_type || null,
    data.original_filename || null,
    data.file_ext || null,
    data.file_size || null,
    data.storage_provider || "r2",
    data.bucket_name || null,
    data.object_key,
    data.status || "pending",
    data.caption || null,
    data.uploaded_by || null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function findMediaById(id) {
  const query = `
    SELECT *
    FROM media_assets
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function bindMediaToMessage({ mediaId, messageId }) {
  const query = `
    UPDATE media_assets
    SET
      message_id = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *;
  `;

  const result = await pool.query(query, [messageId, mediaId]);
  return result.rows[0] || null;
}

module.exports = {
  createMediaAsset,
  findMediaById,
  bindMediaToMessage,
};