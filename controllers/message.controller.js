const axios = require("axios");
const messageModel = require("../models/message.model");
const conversationModel = require("../models/conversation.model");
const { getIO } = require("../socket");
const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const mediaRepository = require("../repositories/media.repository");

const DIRECT_MEDIA_MAX = 20 * 1024 * 1024; // 20MB

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

function buildWhatsAppTextPayload({ to, text }) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      body: String(text || "").trim(),
    },
  };
}

function buildLinkFallbackText({ fileName, mediaUrl, fileSize, reason }) {
  const sizeMb = fileSize
    ? `${(Number(fileSize) / 1024 / 1024).toFixed(2)} MB`
    : "";

  const header =
    reason === "force_link_over_20mb"
      ? "Large file shared as link:"
      : "File shared as link:";

  return [header, fileName || "attachment", sizeMb, mediaUrl]
    .filter(Boolean)
    .join("\n");
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

function emitMessageStatus(io, payload) {
  console.log("📡 EMIT message:status", payload);
  io.emit("message:status", payload);
}

function emitConversationUpdated(io, conversation) {
  console.log("📡 EMIT conversation:updated", {
    id: conversation?.id,
    status: conversation?.status,
    last_message_id: conversation?.last_message_id,
    last_message_at: conversation?.last_message_at,
    has_failed: conversation?.has_failed,
  });
  io.emit("conversation:updated", { conversation });
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
  return rows[0] || null;
}

async function updateMessageAfterMediaSent(messageId, waMessageId, rawPayload) {
  const sql = `
    UPDATE messages
    SET
      wa_message_id = $2::text,
      whatsapp_message_id = $3::varchar(255),
      status = 'sent',
      raw_payload = $4::jsonb,
      sent_at = NOW(),
      updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING *;
  `;

  const waId = waMessageId || null;
  const payload = rawPayload || null;

  const { rows } = await db.query(sql, [messageId, waId, waId, payload]);

  return rows[0] || null;
}

async function updateMessageAfterMediaFailed(messageId, rawPayload) {
  const sql = `
    UPDATE messages
    SET
      status = 'failed',
      raw_payload = $2::jsonb,
      updated_at = NOW()
    WHERE id = $1::uuid
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

    const phone = await getPhoneFromConversation(conversation);

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

    const message = await messageModel.createMessage({
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
      const payload = buildWhatsAppTextPayload({ to: phone, text: bodyText });

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
        });

      const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
        conversation.id
      );

      emitMessageStatus(io, {
        messageId: updatedMessage.id,
        waMessageId,
        status: updatedMessage.status,
        failed_dismissed: updatedMessage.failed_dismissed,
      });

      emitConversationUpdated(io, {
        ...updatedConversation,
        phone,
        profile_name: conversation.profile_name,
        notes: conversation.notes || "",
        has_failed: hasFailed,
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

      emitMessageStatus(io, {
        messageId: failedMessage.id,
        status: failedMessage.status,
        failed_dismissed: failedMessage.failed_dismissed,
      });

      emitConversationUpdated(io, {
        id: conversation.id,
        has_failed: hasFailed,
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
    const messageId = String(req.params.id || "").trim();

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Invalid message id",
      });
    }

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

    const phone = await getPhoneFromConversation(conversation);
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
      buildWhatsAppTextPayload({ to: phone, text }),
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
      });

    const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
      message.conversation_id
    );

    const io = getIO();

    emitMessageStatus(io, {
      messageId: updatedMessage.id,
      waMessageId,
      status: updatedMessage.status,
      failed_dismissed: updatedMessage.failed_dismissed,
    });

    emitConversationUpdated(io, {
      ...updatedConversation,
      phone,
      profile_name: conversation.profile_name,
      notes: conversation.notes || "",
      has_failed: hasFailed,
    });

    return res.json({
      success: true,
      message: updatedMessage,
    });
  } catch (error) {
    const messageId = String(req.params.id || "").trim();

    try {
      if (messageId) {
        await messageModel.markMessageFailed(
          messageId,
          error?.response?.data || { message: error.message }
        );
      }
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
    const messageId = String(req.params.id || "").trim();

    if (!messageId) {
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

    emitMessageStatus(io, {
      messageId: updatedMessage.id,
      status: updatedMessage.status,
      failed_dismissed: true,
    });

    emitConversationUpdated(io, {
      id: updatedMessage.conversation_id,
      has_failed: hasFailed,
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
    const messageId = String(req.params.id || "").trim();

    if (!messageId) {
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

    emitConversationUpdated(io, {
      id: deletedMessage.conversation_id,
      has_failed: hasFailed,
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
  const io = getIO();
  let message = null;
  let normalizedConversationId = "";
  let conversation = null;
  let phone = null;

  try {
    console.log("=== createMediaMessage HIT ===");
    console.log("createMediaMessage req.body =", req.body);

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

    normalizedConversationId = String(conversationId).trim();
    const normalizedCustomerId = String(customerId).trim();

    conversation = await conversationModel.getConversationById(
      normalizedConversationId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    phone = await getPhoneFromConversation(conversation);

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Customer has no phone number",
      });
    }

    console.log("STEP A before findMediaById", { mediaId });
    const media = await mediaRepository.findMediaById(mediaId);
    console.log("STEP B media loaded", media);

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

    message = await insertOutboundMediaMessage({
      conversationId: normalizedConversationId,
      customerId: normalizedCustomerId,
      phone,
      caption,
      mediaType,
    });

    if (!message) {
      throw new Error("Failed to create local outbound media message");
    }

    console.log("STEP 1 created local outbound media message", {
      messageId: message.id,
      conversationId: normalizedConversationId,
      mediaId,
      mediaType,
      status: message.status,
    });

    const sendingTimeoutMs = 45000;
    setTimeout(async () => {
      try {
        const check = await db.query(
          `SELECT id, status FROM messages WHERE id = $1 LIMIT 1`,
          [message.id]
        );

        const row = check.rows?.[0];
        if (row && row.status === "sending") {
          console.warn("⚠ FORCE FIX sending → failed", {
            messageId: message.id,
          });

          const failedMessage = await updateMessageAfterMediaFailed(message.id, {
            message: "timeout fallback after media send",
          });

          emitMessageStatus(io, {
            messageId: failedMessage?.id || message.id,
            status: failedMessage?.status || "failed",
            failed_dismissed: failedMessage?.failed_dismissed || false,
          });

          if (normalizedConversationId) {
            const hasFailed =
              await messageModel.hasActiveFailedMessagesByConversationId(
                normalizedConversationId
              );

            emitConversationUpdated(io, {
              id: normalizedConversationId,
              has_failed: hasFailed,
            });
          }
        }
      } catch (timeoutErr) {
        console.error("sending-timeout fallback error:", timeoutErr);
      }
    }, sendingTimeoutMs);

    console.log("STEP C before bindMediaToMessage", {
      mediaId,
      messageId: message.id,
    });

    const boundMedia = await mediaRepository.bindMediaToMessage({
      mediaId,
      messageId: message.id,
    });

    if (!boundMedia) {
      throw new Error("Failed to bind media to message");
    }

    console.log("STEP 2 media bound to message", {
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

    const payload = buildWhatsAppMediaPayload({
      to: phone,
      media,
      caption,
    });

    console.log("STEP 3 sending WhatsApp media", {
      messageId: message.id,
      mediaType,
      to: phone,
      payloadType: payload.type,
    });

    const fileSize = Number(media.file_size || 0);
    const mediaUrl = buildPublicMediaUrl(media);

    let waMessageId = null;
    let whatsappResponseData = null;
    let transport = "whatsapp_media";
    let fallbackReason = null;

    // ✅ 超过 20MB，直接强制走 link fallback
    if (fileSize > DIRECT_MEDIA_MAX) {
      console.log("🚨 FORCE LINK FALLBACK: file too large for native WhatsApp media", {
        messageId: message.id,
        fileName: media.original_filename,
        fileSize,
      });

      transport = "r2_link";
      fallbackReason = "force_link_over_20mb";

      const linkText = buildLinkFallbackText({
        fileName: media.original_filename,
        mediaUrl,
        fileSize,
        reason: fallbackReason,
      });

      const fallbackResponse = await axios.post(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
        buildWhatsAppTextPayload({ to: phone, text: linkText }),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      whatsappResponseData = fallbackResponse.data;
      waMessageId = fallbackResponse?.data?.messages?.[0]?.id || null;
    } else {
      // ✅ 20MB以内才允许走原生媒体
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

      whatsappResponseData = response.data;
      waMessageId = response?.data?.messages?.[0]?.id || null;

      if (!waMessageId) {
        throw new Error("WhatsApp media send succeeded but waMessageId is missing");
      }
    }

    console.log("STEP 4 media transport result", {
      messageId: message.id,
      waMessageId,
      mediaType,
      transport,
      fileSize,
      fallbackReason,
    });

    if (!waMessageId) {
      throw new Error("WhatsApp media/link send succeeded but waMessageId is missing");
    }

    if (whatsappResponseData) {
      whatsappResponseData._transport = transport;
      whatsappResponseData._original_media_type = mediaType;
      whatsappResponseData._media_url = mediaUrl;
      whatsappResponseData._file_name = media.original_filename || "";
      whatsappResponseData._file_size = fileSize;
      whatsappResponseData._fallback_reason = fallbackReason;
    }

    console.log("STEP 5 before DB update after media sent", {
      messageId: message.id,
      waMessageId,
      transport,
    });

    const updatedMessage = await updateMessageAfterMediaSent(
      message.id,
      waMessageId,
      whatsappResponseData
    );

    console.log("STEP 6 DB update result", updatedMessage);

    if (!updatedMessage) {
      throw new Error("Failed to update message status in DB after media send");
    }

    const updatedConversation =
      await conversationModel.updateConversationAfterOutbound({
        conversationId: normalizedConversationId,
        lastMessageId: updatedMessage.id,
        lastMessageAt: updatedMessage.sent_at || new Date(),
      });

    const hasFailed = await messageModel.hasActiveFailedMessagesByConversationId(
      normalizedConversationId
    );

    console.log("STEP 7 emitting media message status", {
      messageId: updatedMessage.id,
      waMessageId,
      status: updatedMessage.status,
      transport,
    });

    emitMessageStatus(io, {
      messageId: updatedMessage.id,
      waMessageId,
      status: updatedMessage.status,
      failed_dismissed: false,
    });

    emitConversationUpdated(io, {
      ...updatedConversation,
      phone,
      profile_name: conversation.profile_name,
      notes: conversation.notes || "",
      has_failed: hasFailed,
    });

    return res.status(201).json({
      success: true,
      message: updatedMessage,
      media: {
        ...media,
        message_id: updatedMessage.id,
      },
      whatsapp: whatsappResponseData,
    });
  } catch (error) {
    console.error("❌ createMediaMessage FULL ERROR:");
    console.error(error);
    console.error(error.stack);

    if (message?.id) {
      try {
        const failedMessage = await updateMessageAfterMediaFailed(message.id, {
          message: error.message,
          stack: error.stack,
        });

        emitMessageStatus(io, {
          messageId: failedMessage?.id || message.id,
          status: failedMessage?.status || "failed",
          failed_dismissed: failedMessage?.failed_dismissed || false,
        });

        if (normalizedConversationId) {
          const hasFailed =
            await messageModel.hasActiveFailedMessagesByConversationId(
              normalizedConversationId
            );

          emitConversationUpdated(io, {
            id: normalizedConversationId,
            has_failed: hasFailed,
          });
        }
      } catch (markFailedErr) {
        console.error("mark failed after media error failed:", markFailedErr);
      }
    }

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