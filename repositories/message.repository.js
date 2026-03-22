const db = require("../config/db");

async function getMessagesByConversationId(conversationId) {
  const result = await db.query(
    `
    SELECT 
      m.id,
      m.conversation_id,
      m.customer_id,
      m.direction,
      m.content,
      m.created_at,
      m.status,
      m.message_type,

      COALESCE(
        json_agg(
          json_build_object(
            'id', ma.id,
            'media_type', ma.media_type,
            'mime_type', ma.mime_type,
            'original_filename', ma.original_filename,
            'object_key', ma.object_key,
            'file_size', ma.file_size
          )
        ) FILTER (WHERE ma.id IS NOT NULL),
        '[]'
      ) AS media_assets

    FROM messages m
    LEFT JOIN media_assets ma
      ON ma.message_id = m.id

    WHERE m.conversation_id = $1

    GROUP BY 
      m.id,
      m.conversation_id,
      m.customer_id,
      m.direction,
      m.content,
      m.created_at,
      m.status,
      m.message_type

    ORDER BY m.created_at ASC
    `,
    [conversationId]
  );

  return result.rows;
}

  return result.rows;
}

module.exports = {
  getMessagesByConversationId,
};