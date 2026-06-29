const express = require("express");
const multer = require("multer");

const router = express.Router();

const controller = require("../controllers/portalController");
const reportController = require("../controllers/reportController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

// =========================
// Reports
// =========================

router.get("/reports/sales", reportController.getSalesReport);
router.get("/reports/sales/export", reportController.exportSalesReport);

// =========================
// Statements
// =========================

router.get(
  "/statements/customer/export",
  reportController.exportCustomerStatement
);

// =========================
// Customers
// =========================

router.get("/customers", controller.getCustomers);
router.post("/customers", controller.createCustomer);

// =========================
// Batches
// =========================

router.get("/batches", controller.getBatches);
router.post("/batches", controller.createBatch);
router.get("/batches/:id", controller.getBatchById);

router.get("/batches/:batchId/items", controller.getBatchItems);
router.post("/batch-items", controller.createBatchItem);

router.get("/batches/:batchId/shipments", controller.getShipments);

// =========================
// Payments / Allocations
// =========================

router.get("/payments", controller.getPayments);
router.post("/payments", controller.createPayment);

router.get("/allocations", controller.getAllocations);
router.post("/allocations", controller.createAllocation);

router.get("/available-allocations", controller.getAvailableAllocations);

// =========================
// Shipments
// =========================

router.post("/shipments", controller.createShipment);

router.get(
  "/shipments/:shipmentId/allocations",
  controller.getShipmentAllocations
);

router.post("/shipment-allocations", controller.createShipmentAllocation);
router.delete(
  "/shipment-allocations/:id",
  controller.deleteShipmentAllocation
);

// =========================
// Documents
// =========================

router.get("/documents", controller.getDocuments);
router.post("/documents", upload.single("file"), controller.createDocument);
router.get("/documents/:id", controller.getDocumentById);

module.exports = router;