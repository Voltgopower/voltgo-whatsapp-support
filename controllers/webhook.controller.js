console.log("🔥 WEBHOOK VERSION V7 ACTIVE 🔥");

const axios = require("axios");

const customerModel = require("../models/customer.model");
const conversationModel = require("../models/conversation.model");
const messageModel = require("../models/message.model");
const { getIO } = require("../socket");
const { detectTagsFromText } = require("../utils/autoTag");
const { detectIntent } = require("../utils/detectIntent");
const {
  saveWebhookReceived,
  saveWebhookFailure,
} = require("../utils/webhookFailSafe");
const { uploadToR2, bucket } = require("../config/r2");
const { buildObjectKey } = require("../utils/object-key.util");
const mediaRepository = require("../repositories/media.repository");

function getInboundMessage(payload) {
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  const contact = value?.contacts?.[0];
  const message = value?.messages?.[0];

  if (!message) return null;

  let text = "[non-text message]";

  if (message?.text?.body) {
    text = message.text.body;
  } else if (message?.type) {
    text = `[${message.type} message]`;
  }

  return {
    phone: message.from,
    profileName: contact?.profile?.name || message.from,
    waMessageId: message.id,
    text,
    sentAt: message?.timestamp
      ? new Date(Number(message.timestamp) * 1000)
      : new Date(),
    rawPayload: payload,
    rawMessage: message,
  };
}

function getStatusUpdate(payload) {
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const status = value?.statuses?.[0];

  if (!status) return null;

  return {
    waMessageId: status.id,
    status: status.status,
    rawPayload: payload,
  };
}

function normalizeWebhookStatus(status) {
  const raw = String(status || "").toLowerCase();

  if (raw === "sent") return "sent";
  if (raw === "delivered") return "delivered";
  if (raw === "read") return "read";
  if (raw === "failed") return "failed";

  return "sent";
}

function getStatusPriority(status) {
  const map = {
    sending: 0,
    sent: 1,
    delivered: 2,
    read: 3,
    failed: 99,
  };

  return map[String(status || "").toLowerCase()] ?? -1;
}

function shouldSkipStatusUpdate(currentStatus, newStatus) {
  const current = String(currentStatus || "").toLowerCase();
  const next = String(newStatus || "").toLowerCase();

  if (!current) return false;
  if (current === next) return true;

  // failed 一旦落库，默认不再被低优先级状态覆盖
  if (current === "failed" && next !== "failed") return true;

  return getStatusPriority(next) < getStatusPriority(current);
}

function isConversationUnassigned(conversation) {
  const assignedTo = conversation?.assigned_to;

  return (
    assignedTo === null ||
    assignedTo === undefined ||
    assignedTo === "" ||
    assignedTo === "Unassigned" ||
    assignedTo === "null"
  );
}

async function reloadConversationForEmit(
  customer,
  conversationId,
  fallbackConversation
) {
  try {
    const freshConversation = await conversationModel.getConversationById(
      conversationId
    );

    if (freshConversation) {
      return {
        ...freshConversation,
        phone: customer.phone,
        profile_name: customer.profile_name,
        notes: customer.notes || "",
      };
    }
  } catch (reloadError) {
    console.error("reloadConversationForEmit error:", reloadError);
  }

  return {
    ...fallbackConversation,
    phone: customer.phone,
    profile_name: customer.profile_name,
    notes: customer.notes || "",
  };
}

async function emitConversationAfterStatusUpdate(updatedMessage) {
  try {
    if (!updatedMessage?.conversation_id) return;

    const hasFailed =
      await messageModel.hasActiveFailedMessagesByConversationId(
        updatedMessage.conversation_id
      );

    const freshConversation = await conversationModel.getConversationById(
      updatedMessage.conversation_id
    );

    const payloadConversation = freshConversation
      ? {
          ...freshConversation,
          has_failed: hasFailed,
        }
      : {
          id: updatedMessage.conversation_id,
          has_failed: hasFailed,
        };

    getIO().emit("conversation:updated", {
      conversation: payloadConversation,
    });
  } catch (err) {
    console.error("emitConversationAfterStatusUpdate error:", err);
  }
}

function getInboundMediaMeta(rawMessage) {
  if (!rawMessage?.type) return null;

  if (rawMessage.type === "image" && rawMessage.image?.id) {
    return {
      mediaId: rawMessage.image.id,
      mediaType: "image",
      mimeType: rawMessage.image.mime_type || "image/jpeg",
      originalFilename: `wa_${rawMessage.image.id}.${guessExt(
        rawMessage.image.mime_type || "image/jpeg"
      )}`,
      caption: rawMessage.image.caption || null,
    };
  }

  if (rawMessage.type === "video" && rawMessage.video?.id) {
    return {
      mediaId: rawMessage.video.id,
      mediaType: "video",
      mimeType: rawMessage.video.mime_type || "video/mp4",
      originalFilename: `wa_${rawMessage.video.id}.${guessExt(
        rawMessage.video.mime_type || "video/mp4"
      )}`,
      caption: rawMessage.video.caption || null,
    };
  }

  if (rawMessage.type === "audio" && rawMessage.audio?.id) {
    return {
      mediaId: rawMessage.audio.id,
      mediaType: "audio",
      mimeType: rawMessage.audio.mime_type || "audio/ogg",
      originalFilename: `wa_${rawMessage.audio.id}.${guessExt(
        rawMessage.audio.mime_type || "audio/ogg"
      )}`,
      caption: null,
    };
  }

  if (rawMessage.type === "document" && rawMessage.document?.id) {
    return {
      mediaId: rawMessage.document.id,
      mediaType: "document",
      mimeType:
        rawMessage.document.mime_type || "application/octet-stream",
      originalFilename:
        rawMessage.document.filename ||
        `wa_${rawMessage.document.id}.${guessExt(
          rawMessage.document.mime_type || "application/octet-stream"
        )}`,
      caption: rawMessage.document.caption || null,
    };
  }

  return null;
}

function guessExt(mimeType = "") {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("mpeg")) return "mpeg";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("word")) return "doc";
  if (mimeType.includes("officedocument")) return "docx";
  return "bin";
}

async function fetchWhatsAppMediaUrl(mediaId) {
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v22.0";
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is missing");
  }

  const metaRes = await axios.get(
    `https://graph.facebook.com/${graphVersion}/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!metaRes?.data?.url) {
    throw new Error("Failed to get WhatsApp media URL");
  }

  return metaRes.data.url;
}

async function downloadWhatsAppMediaBuffer(mediaUrl) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const fileRes = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return Buffer.from(fileRes.data);
}

async function persistInboundMedia({
  rawMessage,
  conversation,
  customer,
  message,
}) {
  const mediaMeta = getInboundMediaMeta(rawMessage);

  if (!mediaMeta) return null;

  console.log("📦 inbound media detected:", mediaMeta);

  const mediaUrl = await fetchWhatsAppMediaUrl(mediaMeta.mediaId);
  const buffer = await downloadWhatsAppMediaBuffer(mediaUrl);

  const objectKey = buildObjectKey({
    direction: "inbound",
    conversationId: conversation.id,
    messageId: message.id,
    originalFilename: mediaMeta.originalFilename,
  });

  await uploadToR2({
    buffer,
    key: objectKey,
    contentType: mediaMeta.mimeType,
  });

  const fileExt = guessExt(mediaMeta.mimeType);

  const mediaAsset = await mediaRepository.createMediaAsset({
    message_id: message.id,
    conversation_id: conversation.id,
    channel: "whatsapp",
    direction: "inbound",
    media_type: mediaMeta.mediaType,
    mime_type: mediaMeta.mimeType,
    original_filename: mediaMeta.originalFilename,
    file_ext: fileExt || null,
    file_size: buffer.length,
    storage_provider: "r2",
    bucket_name: bucket,
    object_key: objectKey,
    status: "ready",
    caption: mediaMeta.caption,
    uploaded_by: null,
  });

  console.log("✅ inbound media stored:", {
    mediaAssetId: mediaAsset?.id,
    messageId: message.id,
    objectKey,
  });

  return mediaAsset;
}

async function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("=== webhook verify request ===");
  console.log("mode =", mode);
  console.log("token =", token);
  console.log("challenge =", challenge);
  console.log("env token =", process.env.WEBHOOK_VERIFY_TOKEN);

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verify failed");
  return res.sendStatus(403);
}

async function receiveWebhook(req, res) {
  try {
    saveWebhookReceived(req.body);
    console.log("=== webhook received ===");
    console.log(JSON.stringify(req.body, null, 2));

    const statusUpdate = getStatusUpdate(req.body);

    if (statusUpdate) {
      try {
        console.log("📥 webhook status received:", statusUpdate);

        const normalizedStatus = normalizeWebhookStatus(statusUpdate.status);

        const existingMessage = await messageModel.findByExternalMessageId(
          statusUpdate.waMessageId
        );

        if (!existingMessage) {
          console.log(
            "⚠ status update skipped: message not found",
            statusUpdate.waMessageId
          );
          return res.sendStatus(200);
        }

        if (
          shouldSkipStatusUpdate(existingMessage.status, normalizedStatus)
        ) {
          console.log("⏭ skip webhook status update", {
            waMessageId: statusUpdate.waMessageId,
            currentStatus: existingMessage.status,
            incomingStatus: normalizedStatus,
          });
          return res.sendStatus(200);
        }

        const updatedMessage = await messageModel.updateStatusByWaMessageId(
          statusUpdate.waMessageId,
          normalizedStatus,
          statusUpdate.rawPayload
        );

        if (updatedMessage) {
          console.log("✅ webhook status updated", {
            messageId: updatedMessage.id,
            waMessageId: statusUpdate.waMessageId,
            status: updatedMessage.status,
          });

          getIO().emit("message:status", {
            waMessageId: statusUpdate.waMessageId,
            status: updatedMessage.status,
            messageId: updatedMessage.id,
          });

          await emitConversationAfterStatusUpdate(updatedMessage);
        } else {
          console.log(
            "⚠ status update returned no message",
            statusUpdate.waMessageId
          );
        }

        return res.sendStatus(200);
      } catch (statusErr) {
        console.error("webhook status update error:", statusErr);
        return res.sendStatus(200);
      }
    }

    const incoming = getInboundMessage(req.body);

    if (!incoming) {
      console.log("Webhook ignored: no inbound message parsed");
      return res.status(200).json({
        success: true,
        ignored: true,
      });
    }

    console.log("Parsed inbound message:", incoming);

    const existingMessage = await messageModel.findByExternalMessageId(
      incoming.waMessageId
    );

    if (existingMessage) {
      console.log("duplicate inbound message skipped:", incoming.waMessageId);
      return res.sendStatus(200);
    }

    let customer = await customerModel.findByPhone(incoming.phone);

    if (!customer) {
      customer = await customerModel.createCustomer({
        phone: incoming.phone,
        profileName: incoming.profileName,
      });
    } else {
      customer = await customerModel.touchCustomer(
        customer.id,
        incoming.profileName
      );
    }

    let conversation = await conversationModel.findOpenByCustomerId(customer.id);

    if (!conversation) {
      conversation = await conversationModel.createConversation({
        customerId: customer.id,
        lastMessageAt: incoming.sentAt,
        lastMessagePreview: incoming.text,
      });
    }

    const message = await messageModel.createMessage({
      conversationId: conversation.id,
      customerId: customer.id,
      waMessageId: incoming.waMessageId,
      phone: incoming.phone,
      text: incoming.text,
      direction: "inbound",
      status: "delivered",
      rawPayload: incoming.rawPayload,
      sentAt: incoming.sentAt,
    });

    try {
      await persistInboundMedia({
        rawMessage: incoming.rawMessage,
        conversation,
        customer,
        message,
      });
    } catch (mediaErr) {
      console.error("persistInboundMedia error:", mediaErr);
    }

    conversation = await conversationModel.updateConversationAfterInbound({
      conversationId: conversation.id,
      lastMessageId: message.id,
      lastMessageAt: incoming.sentAt,
      preview: incoming.text,
    });

    try {
      const autoTags = detectTagsFromText(incoming.text);

      if (autoTags.length > 0) {
        console.log("Auto tags detected:", autoTags);

        for (const tag of autoTags) {
          await customerModel.addTagToCustomer(customer.id, tag);
        }
      }
    } catch (err) {
      console.error("auto tag error:", err);
    }

    try {
      console.log("=== AUTO ASSIGN START ===");

      const result = detectIntent(incoming.text);
      console.log("detectIntent result =", result);

      const intent = result?.intent;

      const latestConversation = await conversationModel.getConversationById(
        conversation.id
      );

      console.log("assigned_to BEFORE =", latestConversation?.assigned_to);

      if (isConversationUnassigned(latestConversation)) {
        let targetUserId = null;

        if (intent === "support") {
          targetUserId = 3;
        } else if (intent === "sales") {
          targetUserId = 2;
        } else {
          console.log("skip auto assign: unknown intent");
          return;
        }

        const assignedConversation =
          await conversationModel.assignConversationIfUnassigned(
            conversation.id,
            targetUserId
          );

        if (assignedConversation) {
          console.log("auto assigned success:", {
            conversationId: conversation.id,
            assigned_to: assignedConversation.assigned_to,
            assigned_username: assignedConversation.assigned_username,
          });
        } else {
          console.log(
            "skip auto assign: already assigned by another process or manual action"
          );
        }
      } else {
        console.log("conversation already assigned, skip auto assign");
      }
    } catch (err) {
      console.error("auto assign error:", err);
    }

    const emitConversation = await reloadConversationForEmit(
      customer,
      conversation.id,
      conversation
    );

    try {
      const io = getIO();

      io.emit("conversation:updated", {
        conversation: emitConversation,
      });

      io.emit("message:new", {
        conversationId: emitConversation.id,
        message,
      });
    } catch (socketError) {
      console.log("socket emit skipped:", socketError.message);
    }

    return res.status(200).json({
      success: true,
      type: "message",
    });
  } catch (error) {
    saveWebhookFailure(req.body, error);

    if (error.code === "23505") {
      console.log("duplicate message ignored by unique index");
      return res.sendStatus(200);
    }

    console.error("receiveWebhook error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  verifyWebhook,
  receiveWebhook,
};