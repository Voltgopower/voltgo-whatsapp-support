// utils/object-key.util.js
const { v4: uuidv4 } = require('uuid');
const path = require('path');

function buildObjectKey({
  direction,
  conversationId,
  messageId,
  originalFilename,
}) {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const ext = path.extname(originalFilename) || '';
  const uuid = uuidv4();

  return `whatsapp/${direction}/${yyyy}/${mm}/${dd}/conversation_${conversationId}/message_${messageId}/${uuid}${ext}`;
}

module.exports = {
  buildObjectKey,
};