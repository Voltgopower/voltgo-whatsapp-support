console.log("🔥 WEBHOOK VERSION V5 ACTIVE 🔥");

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
      const updatedMessage = await messageModel.updateStatusByWaMessageId(
        statusUpdate.waMessageId,
        statusUpdate.status,
        statusUpdate.rawPayload
      );

      if (updatedMessage) {
        getIO().emit("message:status", {
          waMessageId: statusUpdate.waMessageId,
          status: statusUpdate.status,
          messageId: updatedMessage.id,
        });
      }

      return res.status(200).json({
        success: true,
        type: "status",
      });
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
        } else {
          // sales 和 unknown 都默认分给 sales
          targetUserId = 2;
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