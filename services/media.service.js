// services/media.service.js
const path = require('path');
const { uploadToR2, getObjectSignedUrl } = require('../config/r2');
const { buildObjectKey } = require('../utils/object-key.util');
const mediaRepository = require('../repositories/media.repository');
const { bucket } = require('../config/r2');

function resolveMediaType(mimeType) {
  if (!mimeType) return 'unknown';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('document') ||
    mimeType.includes('msword') ||
    mimeType.includes('officedocument')
  ) {
    return 'document';
  }
  return 'unknown';
}

async function uploadMedia({
  file,
  conversationId,
  customerId,
  uploadedBy,
  caption,
}) {
  if (!file) {
    throw new Error('No file uploaded');
  }

  if (!conversationId) {
    throw new Error('conversationId is required');
  }

  const mediaType = resolveMediaType(file.mimetype);
  const fileExt = path.extname(file.originalname || '').replace('.', '');

  const objectKey = buildObjectKey({
    direction: 'outbound',
    conversationId,
    messageId: 'temp',
    originalFilename: file.originalname,
  });

  await uploadToR2({
    buffer: file.buffer,
    key: objectKey,
    contentType: file.mimetype,
  });

  const mediaAsset = await mediaRepository.createMediaAsset({
    message_id: null,
    conversation_id: conversationId,
    customer_id: customerId || null,
    channel: 'whatsapp',
    direction: 'outbound',
    media_type: mediaType,
    mime_type: file.mimetype,
    original_filename: file.originalname,
    file_ext: fileExt || null,
    file_size: file.size,
    storage_provider: 'r2',
    bucket_name: bucket,
    object_key: objectKey,
    status: 'ready',
    caption: caption || null,
    uploaded_by: uploadedBy || null,
  });

  return mediaAsset;
}

async function getMediaSignedUrl(mediaId) {
  const media = await mediaRepository.findMediaById(mediaId);

  if (!media) {
    throw new Error('Media not found');
  }

  if (!media.object_key) {
    throw new Error('Media object_key is missing');
  }

  const url = await getObjectSignedUrl(media.object_key, 60 * 15);

  return {
    id: media.id,
    url,
    expiresIn: 900,
    mediaType: media.media_type,
    mimeType: media.mime_type,
    originalFilename: media.original_filename,
    objectKey: media.object_key,
  };
}

module.exports = {
  uploadMedia,
  getMediaSignedUrl,
};