const customerModel = require("../models/customer.model");

async function getCustomerById(req, res) {
  try {
    const customerId = String(req.params.id || "").trim();

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id",
      });
    }

    const customer = await customerModel.getCustomerById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("getCustomerById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function updateCustomerNotes(req, res) {
  try {
    const customerId = String(req.params.id || "").trim();
    const { notes } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id",
      });
    }

    const customer = await customerModel.updateCustomerNotes(
      customerId,
      notes || ""
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("updateCustomerNotes error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getCustomerTags(req, res) {
  try {
    const customerId = String(req.params.id || "").trim();

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id",
      });
    }

    const tags = await customerModel.getCustomerTags(customerId);

    return res.json({
      success: true,
      tags,
    });
  } catch (error) {
    console.error("getCustomerTags error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function addCustomerTag(req, res) {
  try {
    const customerId = String(req.params.id || "").trim();
    const { tag } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id",
      });
    }

    if (!tag || !String(tag).trim()) {
      return res.status(400).json({
        success: false,
        message: "Tag is required",
      });
    }

    const result = await customerModel.addCustomerTag(
      customerId,
      String(tag).trim()
    );

    return res.json({
      success: true,
      tag: result,
    });
  } catch (error) {
    console.error("addCustomerTag error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function removeCustomerTag(req, res) {
  try {
    const customerId = String(req.params.id || "").trim();
    const { tag_id, tag } = req.body || {};

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id",
      });
    }

    let removed = null;

    if (tag_id) {
      removed = await customerModel.removeCustomerTagById(customerId, tag_id);
    } else if (tag) {
      removed = await customerModel.removeCustomerTagByName(
        customerId,
        String(tag)
      );
    } else {
      return res.status(400).json({
        success: false,
        message: "tag_id or tag is required",
      });
    }

    return res.json({
      success: true,
      removed,
    });
  } catch (error) {
    console.error("removeCustomerTag error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getCustomerById,
  updateCustomerNotes,
  getCustomerTags,
  addCustomerTag,
  removeCustomerTag,
};