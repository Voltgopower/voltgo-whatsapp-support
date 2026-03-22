// controllers/media.controller.js
const mediaService = require('../services/media.service');

async function uploadMedia(req, res) {
  try {
    const { conversationId, customerId, caption } = req.body;

    const mediaAsset = await mediaService.uploadMedia({
      file: req.file,
      conversationId,
      customerId,
      uploadedBy: req.user?.id || null,
      caption,
    });

    return res.status(201).json({
      success: true,
      data: mediaAsset,
    });
  } catch (error) {
    console.error('[MEDIA_UPLOAD_ERROR]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload media',
    });
  }
}

async function getMediaUrl(req, res) {
  try {
    const { id } = req.params;

    const result = await mediaService.getMediaSignedUrl(id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[MEDIA_URL_ERROR]', error);

    const statusCode = error.message === 'Media not found' ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to get media URL',
    });
  }
}

module.exports = {
  uploadMedia,
  getMediaUrl,
};