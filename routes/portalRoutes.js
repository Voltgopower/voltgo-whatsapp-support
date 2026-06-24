const express = require("express");
const multer = require("multer");

const router = express.Router();
const controller = require("../controllers/portalController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

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

router.get("/documents", controller.getDocuments);
router.post("/documents", upload.single("file"), controller.createDocument);
router.get("/documents/:id", controller.getDocumentById);

module.exports = router;