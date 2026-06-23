const express = require("express");

const router = express.Router();

const controller = require("../controllers/portalController");

router.get("/customers", controller.getCustomers);

router.post("/customers", controller.createCustomer);

router.get("/batches", controller.getBatches);
router.post("/batches", controller.createBatch);

router.get("/payments", controller.getPayments);
router.post("/payments", controller.createPayment);

router.get("/allocations", controller.getAllocations);
router.post("/allocations", controller.createAllocation);

router.get("/batches/:id", controller.getBatchById);

router.get("/batches/:batchId/items", controller.getBatchItems);
router.post("/batch-items", controller.createBatchItem);

module.exports = router;