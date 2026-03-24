const axios = require("axios");
const messageModel = require("../models/message.model");
const conversationModel = require("../models/conversation.model");
const { getIO } = require("../socket");
const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const mediaRepository = require("../repositories/media.repository");

function normalizeMediaType(mediaType = "", mimeType = "") {
  const raw = String(mediaType || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();

  if (raw === "image" || mime.startsWith("image/")) return "image";
  if (raw === "video" || mime.startsWith("video/")) return "video";
  if (raw === "audio" || mime.startsWith("audio/")) return "audio";
  if (
    raw === "document" ||
    mime === "application/pdf" ||
    mime.includes("document") ||
    mime.includes("msword") ||
    mime.includes("officedocument")
  ) {
    return "document";
  }

  return "document";
}

function buildPublicMediaUrl(media) {
  const publicBaseUrl = (
    process.env.R2_PUBLIC_BASE_URL ||
    "https://pub-d65abc185349480ca9b9a2206d2cb381.r2.dev"
  ).replace(/\/+$/, "");

  const objectKey = String(media?.object_key || "").replace(/^\/+/, "");

  if (!objectKey) {
    throw new Error("Media object_key is missing");
  }

  return `${publicBaseUrl}/${objectKey}`;
}

function buildWhatsAppMediaPayload({ to, media, caption }) {
  const mediaType = normalizeMediaType(media?.media_type, media?.mime_type);
  const link = buildPublicMediaUrl(media);
  const safeCaption = String(caption || "").trim();

  if (mediaType === "image") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: {
        link,
        ...(safeCaption ? { caption: safeCaption } : {}),
      },
    };
  }

  if (mediaType === "video") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "video",
      video: {
        link,
        ...(safeCaption ? { caption: safeCaption } : {}),
      },
    };
  }

  if (mediaType === "audio") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "audio",
      audio: {
        link,
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: {
      link,
      ...(safeCaption ? { caption: safeCaption } : {}),
      ...(media?.original_filename
        ? { filename: media.original_filename }
        : {}),
    },
  };
}

async function getPhoneFromConversation(conversation) {
  let phone = conversation?.phone || null;

  if (!phone && conversation?.customer_id) {
    const result = await db.query(
      "SELECT phone FROM customers WHERE id = $1 LIMIT 1",
      [conversation.customer_id]
    );
    phone = result.rows?.[0]?.phone || null;
  }

  return phone;
}

async function insertOutboundMediaMessage({
  conversationId,
  customerId,
  phone,
  caption,
  mediaType,
}) {
  const messageId = uuidv4();

  const insertSql = `
    INSERT INTO messages (
      id,
      conversation_id,
      customer_id,
      direction,
      message_type,
      content,
      whatsapp_message_id,
      status,
      raw_payload,
      created_at,
      updated_at,
      wa_message_id,
      phone,
      sent_at,
      text,
      failed_dismissed
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, NULL, $7, NULL, NOW(), NOW(), NULL, $8, NOW(), $9, false
    )
    RETURNING *;
  `;

  const placeholderContent =
    String(caption || "").trim() || `[${mediaType} message]`;

  const insertValues = [
    messageId,
    conversationId,
    customerId,
    "outbound",
    mediaType,
    placeholderContent,
    "sending",
    phone || null,
    placeholderContent,
  ];

  const { rows } = await db.query(insertSql, insertValues);
  return rows[0];
}

async function updateMessageAfterMediaSent(messageId, waMessageId, rawPayload) {
  const sql = `
    UPDATE messages
    SET
      wa_message_id = $2,
      whatsapp_message_id = $2,
      status = 'sent',
      raw_payload = $3,
      sent_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [
    messageId,
    waMessageId || null,
    rawPayload || null,
  ]);

  return rows[0] || null;
}

async function updateMessageAfterMediaFailed(messageId, rawPayload) {
  const sql = `
    UPDATE messages
    SET
      status = 'failed',
      raw_payload = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await db.query(sql, [messageId, rawPayload || null]);
  return rows[0] || null;
}

async function getMessagesByConversation(req, res) {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    console.log("=== GET_MESSAGES HIT ===");
    console.log("conversationId =", conversationId);

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "conversationId is required",
      });
    }

    const sql = `
      SELECT
        m.*,
        COALESCE(ma.media_assets, '[]'::json) AS media_assets
      FROM messages m
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', ma.id,
            'message_id', ma.message_id,
            'conversation_id', ma.conversation_id,
            'customer_id', ma.customer_id,
            'direction', ma.direction,
            'media_type', ma.media_type,
            'mime_type', ma.mime_type,
            'original_filename', ma.original_filename,
            'file_ext', ma.file_ext,
            'file_size', ma.file_size,
            'bucket_name', ma.bucket_name,
            'object_key', ma.object_key,
            'status', ma.status,
            'caption', ma.caption,
            'created_at', ma.created_at
          )
          ORDER BY ma.created_at ASC
        ) AS media_assets
        FROM media_assets ma
        WHERE ma.message_id = m.id
      ) ma ON true
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC, m.id ASC
    `;

    const { rows } = await db.query(sql, [conversationId]);

    console.log("GET_MESSAGES rows count =", rows.length);

    console.log(
      "GET_MESSAGES target row =",
      JSON.stringify(
        rows.find((r) => r.id === "c55325dd-e03a-4311-924f-f776bc7bc965"),
        null,
        2
      )
    );

    return res.json({
      success: true,
      messages: rows,
    });
  } catch (error) {
    console.error("getMessagesByConversation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function sendMessage(req, res) {
  try {
    const { conversationId, text } = req.body;

    if (!conversationId || !text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "conversationId and text are required",
      });
    }

    const normalizedConversationId = String(conversationId).trim();

    const conversation = await conversationModel.getConversationById(
      normalizedConversationId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    let phone = await getPhoneFromConversation(conversation);

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Customer has no phone number",
      });
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

    if (!phoneNumberId || !accessToken) {
      return res.status(500).json({
        success: false,
        message: "Missing WhatsApp env config",
      });
    }

    const bodyText = text.trim();
    const now = new Date();

    let message = await messageModel.createMessage({
      conversationId: conversation.id,
      customerId: conversation.customer_id,
      waMessageId: null,
      phone,
      text: bodyText,
      direction: "outbound",
      status: "sending",
      rawPayload: null,
      sentAt: now,
    });

    const io = getIO();

    io.emit("message:new", {
      conversationId: conversation.id,
      message,
    });

    try {
      const payload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: {
          body: bodyText,
        },
      };

      const response = await axios.post(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      const waMessageId = response?.data?.messages?.[0]?.id || null;

      const updatedMessage = await messageModel.markMessageSent(message.id, {
        waMessageId,
        rawPayload: response.data,
        sentAt: new Date(),
      });

      const updatedConversation =
        await conversationModel.updateConversationAfterOutbound({
          conversationId: conversation.id,
          lastMessageId: updatedMessage.id,
          lastMessageAt: updatedMessage.sent_at || new Date(),
          preview: bodyText,
        });

      const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
        conversation.id
      );

      io.emit("message:status", {
        messageId: updatedMessage.id,
        waMessageId,
        status: updatedMessage.status,
        failed_dismissed: updatedMessage.failed_dismissed,
      });

      io.emit("conversation:updated", {
        conversation: {
          ...updatedConversation,
          phone,
          profile_name: conversation.profile_name,
          notes: conversation.notes || "",
          has_failed: hasFailed,
        },
      });

      return res.json({
        success: true,
        message: updatedMessage,
        whatsapp: response.data,
      });
    } catch (sendError) {
      const failedMessage = await messageModel.markMessageFailed(
        message.id,
        sendError?.response?.data || { message: sendError.message }
      );

      const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
        conversation.id
      );

      io.emit("message:status", {
        messageId: failedMessage.id,
        status: failedMessage.status,
        failed_dismissed: failedMessage.failed_dismissed,
      });

      io.emit("conversation:updated", {
        conversation: {
          id: conversation.id,
          has_failed: hasFailed,
        },
      });

      const apiError =
        sendError?.response?.data?.error?.message ||
        sendError?.response?.data ||
        sendError.message;

      console.error("sendMessage error:", apiError);

      return res.status(500).json({
        success: false,
        message:
          typeof apiError === "string" ? apiError : JSON.stringify(apiError),
      });
    }
  } catch (error) {
    console.error("sendMessage outer error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function retryMessage(req, res) {
  try {
    const messageId = Number(req.params.id);

    const message = await messageModel.getMessageById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (message.direction !== "outbound") {
      return res.status(400).json({
        success: false,
        message: "Only outbound messages can be retried",
      });
    }

    if (message.status !== "failed") {
      return res.status(400).json({
        success: false,
        message: "Only failed messages can be retried",
      });
    }

    const conversation = await conversationModel.getConversationById(
      message.conversation_id
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    let phone = await getPhoneFromConversation(conversation);
    const text = message.text || message.content;

    if (!phone || !text) {
      return res.status(400).json({
        success: false,
        message: "Missing phone or message text",
      });
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

    if (!phoneNumberId || !accessToken) {
      return res.status(500).json({
        success: false,
        message: "Missing WhatsApp env config",
      });
    }

    await messageModel.markMessageSending(messageId);

    const response = await axios.post(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    const waMessageId = response?.data?.messages?.[0]?.id || null;

    const updatedMessage = await messageModel.markMessageSent(messageId, {
      waMessageId,
      rawPayload: response.data,
      sentAt: new Date(),
    });

    const updatedConversation =
      await conversationModel.updateConversationAfterOutbound({
        conversationId: message.conversation_id,
        lastMessageId: updatedMessage.id,
        lastMessageAt: updatedMessage.sent_at || new Date(),
        preview: text,
      });

    const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
      message.conversation_id
    );

    const io = getIO();

    io.emit("message:status", {
      messageId: updatedMessage.id,
      waMessageId,
      status: updatedMessage.status,
      failed_dismissed: updatedMessage.failed_dismissed,
    });

    io.emit("conversation:updated", {
      conversation: {
        ...updatedConversation,
        phone,
        profile_name: conversation.profile_name,
        notes: conversation.notes || "",
        has_failed: hasFailed,
      },
    });

    return res.json({
      success: true,
      message: updatedMessage,
    });
  } catch (error) {
    const messageId = Number(req.params.id);

    try {
      await messageModel.markMessageFailed(
        messageId,
        error?.response?.data || { message: error.message }
      );
    } catch (innerError) {
      console.error("markMessageFailed error:", innerError);
    }

    console.error("retryMessage error:", error?.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message:
        error?.response?.data?.error?.message ||
        error.message ||
        "Retry failed",
    });
  }
}

async function dismissFailedMessage(req, res) {
  try {
    const messageId = Number(req.params.id);

    if (!messageId || Number.isNaN(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message id",
      });
    }

    const updatedMessage = await messageModel.dismissFailedMessage(messageId);

    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        message: "Failed message not found",
      });
    }

    const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
      updatedMessage.conversation_id
    );

    const io = getIO();

    io.emit("message:status", {
      messageId: updatedMessage.id,
      status: updatedMessage.status,
      failed_dismissed: true,
    });

    io.emit("conversation:updated", {
      conversation: {
        id: updatedMessage.conversation_id,
        has_failed: hasFailed,
      },
    });

    return res.json({
      success: true,
      message: updatedMessage,
    });
  } catch (error) {
    console.error("dismissFailedMessage error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function deleteFailedMessage(req, res) {
  try {
    const messageId = Number(req.params.id);

    if (!messageId || Number.isNaN(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message id",
      });
    }

    const deletedMessage = await messageModel.deleteFailedMessage(messageId);

    if (!deletedMessage) {
      return res.status(404).json({
        success: false,
        message: "Failed message not found",
      });
    }

    const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
      deletedMessage.conversation_id
    );

    const io = getIO();

    io.emit("message:deleted", {
      messageId: deletedMessage.id,
      conversationId: deletedMessage.conversation_id,
    });

    io.emit("conversation:updated", {
      conversation: {
        id: deletedMessage.conversation_id,
        has_failed: hasFailed,
      },
    });

    return res.json({
      success: true,
      message: deletedMessage,
    });
  } catch (error) {
    console.error("deleteFailedMessage error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function createMediaMessage(req, res) {
  try {
    const { conversationId, customerId, mediaId, caption } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "conversationId is required",
      });
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "customerId is required",
      });
    }

    if (!mediaId) {
      return res.status(400).json({
        success: false,
        message: "mediaId is required",
      });
    }

    const normalizedConversationId = String(conversationId).trim();
    const normalizedCustomerId = String(customerId).trim();

    const conversation = await conversationModel.getConversationById(
      normalizedConversationId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const phone = await getPhoneFromConversation(conversation);

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Customer has no phone number",
      });
    }

    const media = await mediaRepository.findMediaById(mediaId);

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    if (!media.object_key) {
      return res.status(400).json({
        success: false,
        message: "Media object_key is missing",
      });
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

    if (!phoneNumberId || !accessToken) {
      return res.status(500).json({
        success: false,
        message: "Missing WhatsApp env config",
      });
    }

    const mediaType = normalizeMediaType(media.media_type, media.mime_type);
    const io = getIO();

    let message = await insertOutboundMediaMessage({
      conversationId: normalizedConversationId,
      customerId: normalizedCustomerId,
      phone,
      caption,
      mediaType,
    });

    await mediaRepository.bindMediaToMessage({
      mediaId,
      messageId: message.id,
    });

    io.emit("message:new", {
      conversationId: normalizedConversationId,
      message: {
        ...message,
        media_assets: [
          {
            id: media.id,
            message_id: message.id,
            conversation_id: media.conversation_id,
            customer_id: media.customer_id,
            direction: "outbound",
            media_type: media.media_type,
            mime_type: media.mime_type,
            original_filename: media.original_filename,
            file_ext: media.file_ext,
            file_size: media.file_size,
            bucket_name: media.bucket_name,
            object_key: media.object_key,
            status: media.status,
            caption: media.caption,
            created_at: media.created_at,
          },
        ],
      },
    });

    try {
      const payload = buildWhatsAppMediaPayload({
        to: phone,
        media,
        caption,
      });

      const response = await axios.post(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const waMessageId = response?.data?.messages?.[0]?.id || null;

      const updatedMessage = await updateMessageAfterMediaSent(
        message.id,
        waMessageId,
        response.data
      );

      const previewText =
        String(caption || "").trim() || `[${mediaType} message]`;

      const updatedConversation =
        await conversationModel.updateConversationAfterOutbound({
          conversationId: normalizedConversationId,
          lastMessageId: updatedMessage.id,
          lastMessageAt: updatedMessage.sent_at || new Date(),
          preview: previewText,
        });

      const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
        normalizedConversationId
      );

      io.emit("message:status", {
        messageId: updatedMessage.id,
        waMessageId,
        status: updatedMessage.status,
        failed_dismissed: updatedMessage.failed_dismissed,
      });

      io.emit("conversation:updated", {
        conversation: {
          ...updatedConversation,
          phone,
          profile_name: conversation.profile_name,
          notes: conversation.notes || "",
          has_failed: hasFailed,
        },
      });

      return res.status(201).json({
        success: true,
        message: updatedMessage,
        media: {
          ...media,
          message_id: updatedMessage.id,
        },
        whatsapp: response.data,
      });
    } catch (sendError) {
      const failedMessage = await updateMessageAfterMediaFailed(
        message.id,
        sendError?.response?.data || { message: sendError.message }
      );

      const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
        normalizedConversationId
      );

      io.emit("message:status", {
        messageId: failedMessage.id,
        status: failedMessage.status,
        failed_dismissed: failedMessage.failed_dismissed,
      });

      io.emit("conversation:updated", {
        conversation: {
          id: normalizedConversationId,
          has_failed: hasFailed,
        },
      });

      const apiError =
        sendError?.response?.data?.error?.message ||
        sendError?.response?.data ||
        sendError.message;

      console.error("createMediaMessage send error:", apiError);

      return res.status(500).json({
        success: false,
        message:
          typeof apiError === "string" ? apiError : JSON.stringify(apiError),
      });
    }
  } catch (error) {
    console.error("createMediaMessage error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getMessagesByConversation,
  createMediaMessage,
  sendMessage,
  retryMessage,
  dismissFailedMessage,
  deleteFailedMessage,
};