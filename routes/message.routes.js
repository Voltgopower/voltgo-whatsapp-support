const express = require('express');
const router = express.Router();

const {
  getMessagesByConversation,
  sendMessage,
  sendTemplateMessage
} = require('../controllers/message.controller');

const authMiddleware = require('../middleware/auth.middleware');

console.log('=== message.routes.js loaded ===');

router.get('/conversation/:conversationId', authMiddleware, getMessagesByConversation);

// 普通文本发送
router.post('/send', authMiddleware, sendMessage);

// 模板发送
router.post('/send-template', authMiddleware, sendTemplateMessage);

module.exports = router;