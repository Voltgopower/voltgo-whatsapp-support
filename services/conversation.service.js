const whatsappService = require('./whatsapp.service');
const customerRepository = require('../repositories/customer.repository');
const conversationRepository = require('../repositories/conversation.repository');
const messageRepository = require('../repositories/message.repository');

/**
 * 从 WhatsApp webhook payload 中提取入站消息数据
 */
function extractInboundMessageData(payload) {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];

  if (!message) {
    return null;
  }

  const phone = message.from || null;
  const profileName = contact?.profile?.name || null;
  const waId = contact?.wa_id || phone || null;

  let content = null;

  switch (message.type) {
    case 'text':
      content = message.text?.body || null;
      break;
    case 'image':
      content = message.image?.caption || '[image]';
      break;
    case 'document':
      content = message.document?.caption || message.document?.filename || '[document]';
      break;
    case 'audio':
      content = '[audio]';
      break;
    case 'video':
      content = message.video?.caption || '[video]';
      break;
    case 'sticker':
      content = '[sticker]';
      break;
    case 'button':
      content = message.button?.text || '[button]';
      break;
    case 'interactive':
      if (message.interactive?.button_reply?.title) {
        content = message.interactive.button_reply.title;
      } else if (message.interactive?.list_reply?.title) {
        content = message.interactive.list_reply.title;
      } else {
        content = '[interactive]';
      }
      break;
    case 'location':
      content = '[location]';
      break;
    case 'contacts':
      content = '[contacts]';
      break;
    default:
      content = `[${message.type || 'unknown'}]`;
      break;
  }

  return {
    phone,
    profileName,
    waId,
    whatsappMessageId: message.id || null,
    messageType: message.type || 'unknown',
    content,
    rawPayload: message,
    createdAt: message.timestamp
      ? new Date(Number(message.timestamp) * 1000)
      : new Date(),
  };
}

/**
 * 查找客户，不存在则创建
 */
async function findOrCreateCustomer({ phone, profileName, waId, lastMessageAt }) {
  if (!phone) {
    throw new Error('findOrCreateCustomer: phone is required');
  }

  let customer = await customerRepository.findByPhone(phone);

  if (!customer) {
    customer = await customerRepository.createCustomer({
      phone,
      profileName,
      waId,
      lastMessageAt,
    });
    return customer;
  }

  await customerRepository.updateProfile(customer.id, {
    profileName,
    waId,
  });

  if (lastMessageAt) {
    await customerRepository.updateLastMessageAt(customer.id, lastMessageAt);
  }

  customer = await customerRepository.findByPhone(phone);
  return customer;
}

/**
 * 查找当前 open conversation，没有则 reopen 最近 closed，会再不行就创建
 */
async function findOrCreateOpenConversation({ customerId, lastMessageAt }) {
  if (!customerId) {
    throw new Error('findOrCreateOpenConversation: customerId is required');
  }

  let conversation = await conversationRepository.findOpenByCustomerId(customerId);

  if (conversation) {
    return conversation;
  }

  const latestConversation = await conversationRepository.findLatestByCustomerId(customerId);

  if (latestConversation && latestConversation.status === 'closed') {
    conversation = await conversationRepository.reopenConversation(
      latestConversation.id,
      lastMessageAt
    );
    return conversation;
  }

  conversation = await conversationRepository.createConversation({
    customerId,
    lastMessageAt,
  });

  return conversation;
}

/**
 * 处理入站 WhatsApp 消息
 */
async function processInboundMessage(payload) {
  console.log('=== processInboundMessage reached ===');

  const data = extractInboundMessageData(payload);
  console.log('inbound data =', data);

  if (!data) {
    return {
      success: false,
      skipped: true,
      reason: 'No inbound message found in payload',
    };
  }

  const {
    phone,
    profileName,
    waId,
    whatsappMessageId,
    messageType,
    content,
    rawPayload,
    createdAt,
  } = data;

  if (!phone) {
    throw new Error('processInboundMessage: phone is required');
  }

  if (!whatsappMessageId) {
    throw new Error('processInboundMessage: whatsappMessageId is required');
  }

  const existingMessage = await messageRepository.findByWhatsappMessageId(
    whatsappMessageId
  );

  if (existingMessage) {
    return {
      success: true,
      duplicated: true,
      skipped: false,
      customer: null,
      conversation: null,
      message: existingMessage,
    };
  }

  const customer = await findOrCreateCustomer({
    phone,
    profileName,
    waId,
    lastMessageAt: createdAt,
  });

  let conversation = await findOrCreateOpenConversation({
    customerId: customer.id,
    lastMessageAt: createdAt,
  });
  console.log('conversation after findOrCreateOpenConversation =', conversation);

  const message = await messageRepository.createMessage({
    conversationId: conversation.id,
    customerId: customer.id,
    direction: 'inbound',
    messageType,
    content,
    whatsappMessageId,
    status: 'received',
    rawPayload,
    createdAt,
  });

  conversation = await conversationRepository.updateConversationAfterInbound({
    conversationId: conversation.id,
    lastMessageId: message.id,
    lastMessageAt: createdAt,
  });
  console.log('conversation after updateConversationAfterInbound =', conversation);

  conversation = await conversationRepository.reopenConversation(
    conversation.id,
    createdAt
  );

  await customerRepository.updateLastMessageAt(customer.id, createdAt);

  return {
    success: true,
    duplicated: false,
    skipped: false,
    customer,
    conversation,
    message,
  };
}

/**
 * 处理 WhatsApp message status 更新
 */
async function processStatusUpdate(payload) {
  const statuses =
    payload?.entry?.[0]?.changes?.[0]?.value?.statuses;

  if (!statuses || !Array.isArray(statuses)) {
    return {
      success: false,
      skipped: true,
    };
  }

  for (const statusItem of statuses) {
    console.log('STATUS EVENT:', statusItem);

    const whatsappMessageId = statusItem.id;
    const newStatus = statusItem.status;

    if (!whatsappMessageId || !newStatus) {
      continue;
    }

    await messageRepository.updateMessageStatus({
      whatsappMessageId,
      status: newStatus,
    });
  }

  return {
    success: true,
    updated: statuses.length,
  };
}

async function getMessagesByConversationId(conversationId) {
  if (!conversationId) {
    throw new Error('getMessagesByConversationId: conversationId is required');
  }

  return messageRepository.findMessagesByConversationId(conversationId);
}

async function listConversations({ limit = 20, offset = 0 }) {
  return conversationRepository.findConversationList({
    limit,
    offset,
  });
}

async function markConversationAsRead(conversationId) {
  if (!conversationId) {
    throw new Error('markConversationAsRead: conversationId is required');
  }

  const conversation = await conversationRepository.markConversationAsRead(
    conversationId
  );

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  return conversation;
}

async function closeConversation(conversationId) {
  if (!conversationId) {
    throw new Error('closeConversation: conversationId is required');
  }

  const conversation = await conversationRepository.closeConversation(
    conversationId
  );

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  return conversation;
}

async function sendTextMessageByConversationId({ conversationId, content }) {
  if (!conversationId) {
    throw new Error('sendTextMessageByConversationId: conversationId is required');
  }

  if (!content || !content.trim()) {
    throw new Error('sendTextMessageByConversationId: content is required');
  }

  const conversation = await conversationRepository.findConversationById(
    conversationId
  );

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (!conversation.phone) {
    throw new Error('Customer phone not found');
  }

  if (conversation.status !== 'open') {
    throw new Error('Conversation is not open');
  }

  const sendResult = await whatsappService.sendTextMessage({
    to: conversation.phone,
    body: content.trim(),
  });

  const whatsappMessageId = sendResult?.messages?.[0]?.id || null;
  const createdAt = new Date();

  const message = await messageRepository.createMessage({
    conversationId: conversation.id,
    customerId: conversation.customer_id,
    direction: 'outbound',
    messageType: 'text',
    content: content.trim(),
    whatsappMessageId,
    status: 'sent',
    rawPayload: sendResult,
    createdAt,
  });

  const updatedConversation =
    await conversationRepository.updateConversationAfterOutbound({
      conversationId: conversation.id,
      lastMessageId: message.id,
      lastMessageAt: createdAt,
    });

  if (typeof customerRepository.updateLastMessageAt === 'function') {
    await customerRepository.updateLastMessageAt(
      conversation.customer_id,
      createdAt
    );
  }

  return {
    conversation: updatedConversation,
    message,
    providerResponse: sendResult,
  };
}

module.exports = {
  extractInboundMessageData,
  findOrCreateCustomer,
  findOrCreateOpenConversation,
  processInboundMessage,
  processStatusUpdate,
  getMessagesByConversationId,
  listConversations,
  markConversationAsRead,
  closeConversation,
  sendTextMessageByConversationId,
};