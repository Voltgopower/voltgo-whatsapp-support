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
module.exports = {
  getCustomers,
  createCustomer,
  getBatches,
  createBatch,
};