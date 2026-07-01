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

router.get("/products", controller.getProducts);

router.post("/products", controller.createProduct);

router.put("/products/:id", controller.updateProduct);

router.delete("/products/:id", controller.deleteProduct);

// =========================
// Batches
// =========================

router.get("/batches", controller.getBatches);
router.post("/batches", controller.createBatch);
router.get("/batches/:id", controller.getBatchById);
router.get(
  "/batches/:batchId/product-summary",
  controller.getBatchProductSummary
);

router.get("/batches/:batchId/items", controller.getBatchItems);

router.post("/batch-items", controller.createBatchItem);

router.get("/batches/:batchId/shipments", controller.getShipments);
router.put("/batches/:id", controller.updateBatch);

// =========================
// Payments / Allocations
// =========================

router.get("/payments", controller.getPayments);
router.post("/payments", controller.createPayment);

router.put("/payments/:id", controller.updatePayment);
router.delete("/payments/:id", controller.deletePayment);

router.get("/allocations", controller.getAllocations);
router.post("/allocations", controller.createAllocation);

router.get("/available-allocations", controller.getAvailableAllocations);

// =========================
// Shipments
// =========================

router.post("/shipments", controller.createShipment);
router.delete("/shipments/:id", controller.deleteShipment);

router.get(
  "/shipments/:shipmentId/allocations",
  controller.getShipmentAllocations
);

router.post("/shipment-allocations", controller.createShipmentAllocation);
router.delete(
  "/shipment-allocations/:id",
  controller.deleteShipmentAllocation
);
router.put("/shipments/:id", controller.updateShipment);
// =========================
// Documents
// =========================

router.get("/documents", controller.getDocuments);
router.post("/documents", upload.single("file"), controller.createDocument);
router.get("/documents/:id", controller.getDocumentById);
router.delete("/documents/:id", controller.deleteDocument);

router.get(
  "/shipments/:shipmentId/items",
  controller.getShipmentItems
);

router.post(
  "/shipments/:shipmentId/items",
  controller.createShipmentItem
);

router.delete(
  "/shipment-items/:id",
  controller.deleteShipmentItem
);

module.exports = router;