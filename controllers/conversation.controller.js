const conversationModel = require("../models/conversation.model");
async function listConversations(req, res) {
  try {
    console.log("listConversations req.user =", req.user);

    const { search = "", status = "all", agent = "" } = req.query;

    let effectiveAgent = agent;

    if (status === "mine") {
      effectiveAgent = req.user?.id ? String(req.user.id) : "";
    }

    const payload = {
      search,
      status,
      agent: effectiveAgent,
      currentUserId: req.user?.id ? String(req.user.id) : "",
      currentUserRole: req.user?.role || "",
    };

    console.log("CONTROLLER payload =", payload);

    const conversations = await conversationModel.listConversations(payload);

    return res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("listConversations error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
async function getMessagesByConversationId(req, res) {
  try {
    const conversationId = String(req.params.id || "").trim();

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    const conversation = await conversationModel.getConversationById(
      conversationId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const messages = await conversationModel.getMessagesByConversationId(
      conversationId
    );

    return res.json({
      success: true,
      conversation,
      messages,
    });
  } catch (error) {
    console.error("getMessagesByConversationId error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load messages",
      error: error.message,
    });
  }
}

async function updateConversationStatus(req, res) {
  try {
    const conversationId = String(req.params.id || "").trim();
    const { status } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    if (!status || !["open", "closed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'open' or 'closed'",
      });
    }

    const updatedConversation = await conversationModel.updateConversationStatus(
      conversationId,
      status
    );

    if (!updatedConversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return res.json({
      success: true,
      conversation: updatedConversation,
    });
  } catch (error) {
    console.error("updateConversationStatus error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function assignConversation(req, res) {
  try {
    const conversationId = String(req.params.id || "").trim();
    const { assignedTo } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    let normalizedAssignedTo = null;

    if (assignedTo !== null && assignedTo !== undefined && assignedTo !== "") {
      normalizedAssignedTo = Number(assignedTo);

      if (Number.isNaN(normalizedAssignedTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assignedTo value",
        });
      }
    }

    const updatedConversation = await conversationModel.assignConversation(
      conversationId,
      normalizedAssignedTo
    );

    if (!updatedConversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return res.json({
      success: true,
      conversation: updatedConversation,
    });
  } catch (error) {
    console.error("assignConversation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function markConversationRead(req, res) {
  try {
    const conversationId = String(req.params.id || "").trim();

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    const updatedConversation = await conversationModel.markConversationRead(
      conversationId
    );

    if (!updatedConversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return res.json({
      success: true,
      conversation: updatedConversation,
    });
  } catch (error) {
    console.error("markConversationRead error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  listConversations,
  getMessagesByConversationId,
  updateConversationStatus,
  assignConversation,
  markConversationRead,
};