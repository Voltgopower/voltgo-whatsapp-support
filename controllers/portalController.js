const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { uploadToR2, getObjectSignedUrl } = require("../config/r2");
const repo = require("../repositories/portalRepository");

async function getCustomers(req, res) {
  try {
    const data = await repo.getCustomers();

    res.json(data);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to load customers",
    });
  }
}

async function createCustomer(req, res) {
  try {
    const data = await repo.createCustomer(req.body);

    res.json(data);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to create customer",
    });
  }
}
async function getBatches(req, res) {
  try {
    const data = await repo.getBatches();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load batches" });
  }
}

async function createBatch(req, res) {
  try {
    const data = await repo.createBatch(req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create batch" });
  }
}
async function getPayments(req, res) {
  try {
    const data = await repo.getPayments();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load payments" });
  }
}

async function createPayment(req, res) {
  try {
    const data = await repo.createPayment(req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create payment" });
  }
}

async function getAllocations(req, res) {
  try {
    const data = await repo.getAllocations();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load allocations" });
  }
}

async function createAllocation(req, res) {
  try {
    const data = await repo.createAllocation(req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create allocation" });
  }
}
async function getBatchItems(req, res) {
  try {
    const data = await repo.getBatchItems(req.params.batchId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load batch items" });
  }
}

async function createBatchItem(req, res) {
  try {
    const data = await repo.createBatchItem(req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create batch item" });
  }
}
async function getBatchById(req, res) {
  try {
    const data = await repo.getBatchById(req.params.id);

    if (!data) {
      return res.status(404).json({
        error: "Batch not found",
      });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load batch detail" });
  }
}
async function getDocumentById(req, res) {
  try {
    const data = await repo.getDocumentById(req.params.id);

    if (!data) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    const { getObjectSignedUrl } = require("../config/r2");

    const download_url = await getObjectSignedUrl(data.file_url, 900);

    res.json({
      ...data,
      download_url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load document" });
  }
}
async function getDocuments(req, res) {
  try {
    const data = await repo.getDocuments(req.query);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load documents" });
  }
}

async function createDocument(req, res) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: "File is required",
      });
    }

    const ext = path.extname(file.originalname || "");
    const objectKey = `portal-documents/${Date.now()}-${uuidv4()}${ext}`;

    const uploaded = await uploadToR2({
      buffer: file.buffer,
      key: objectKey,
      contentType: file.mimetype,
    });

    const data = await repo.createDocument({
      title: req.body.title || file.originalname,
      category: req.body.category || "other",
      related_type: req.body.related_type || null,
      related_id: req.body.related_id || null,
      file_name: file.originalname,
      file_url: uploaded.key,
      file_size: file.size,
      mime_type: file.mimetype,
      uploaded_by: req.body.uploaded_by || null,
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload document" });
  }
}
async function getShipments(req, res) {
  try {
    const data = await repo.getShipments(req.params.batchId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load shipments" });
  }
}

async function createShipment(req, res) {
  try {
    const data = await repo.createShipment(req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create shipment" });
  }
}
async function getShipmentAllocations(req, res) {
  try {
    const data = await repo.getShipmentAllocations(req.params.shipmentId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load shipment allocations" });
  }
}

async function createShipmentAllocation(req, res) {
  try {
    const data = await repo.createShipmentAllocation(req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create shipment allocation" });
  }
}

async function getAvailableAllocations(req, res) {
  try {
    const data = await repo.getAvailableAllocations();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load available allocations" });
  }
}
async function deleteShipmentAllocation(req, res) {
  try {
    const data = await repo.deleteShipmentAllocation(req.params.id);
    res.json(data || { success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete shipment allocation" });
  }
}
async function getShipmentItems(req, res) {
  try {
    const data = await repo.getShipmentItems(req.params.shipmentId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load shipment items" });
  }
}

async function createShipmentItem(req, res) {
  try {
    const data = await repo.createShipmentItem(
      req.params.shipmentId,
      req.body
    );
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create shipment item" });
  }
}

async function deleteShipmentItem(req, res) {
  try {
    const data = await repo.deleteShipmentItem(req.params.id);
    res.json(data || { success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete shipment item" });
  }
}
async function getProducts(req, res) {
  try {
    const data = await repo.getProducts();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load products" });
  }
}

async function createProduct(req, res) {
  try {
    const data = await repo.createProduct(req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
}

async function updateProduct(req, res) {
  try {
    const data = await repo.updateProduct(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
}

async function deleteProduct(req, res) {
  try {
    const data = await repo.deleteProduct(req.params.id);
    res.json(data || { success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
}
module.exports = {
  getCustomers,
  createCustomer,
  getBatches,
  createBatch,
  getPayments,
  createPayment,
  getAllocations,
  createAllocation,
  getBatchItems,
  createBatchItem,
  getBatchById,

  getDocuments,
  createDocument,
  getDocumentById,
  getShipments,
  createShipment,
  getShipmentAllocations,
  createShipmentAllocation,
  getAvailableAllocations,
  deleteShipmentAllocation,
  getShipmentItems,
  createShipmentItem,
  deleteShipmentItem,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};