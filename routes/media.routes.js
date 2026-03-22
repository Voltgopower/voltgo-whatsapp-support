// routes/media.routes.js
const express = require('express');
const router = express.Router();

const mediaController = require('../controllers/media.controller');
const { upload } = require('../middleware/upload.middleware');

router.get('/ping', (req, res) => {
  res.json({ success: true, message: 'media route ok' });
});

router.post('/upload', upload.single('file'), mediaController.uploadMedia);
router.get('/:id/url', mediaController.getMediaUrl);

module.exports = router;