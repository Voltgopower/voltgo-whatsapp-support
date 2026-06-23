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
};