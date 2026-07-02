const express = require("express");
const multer = require("multer");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
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

router.get("/reports/sales", authMiddleware, reportController.getSalesReport);
router.get(
  "/reports/sales/export",
  authMiddleware,
  reportController.exportSalesReport
);

// =========================
// Statements
// =========================

router.get(
  "/statements/customer/export",
  authMiddleware,
  reportController.exportCustomerStatement
);

// =========================
// Customers
// =========================

router.get("/customers", authMiddleware, controller.getCustomers);
router.post("/customers", authMiddleware, controller.createCustomer);

// =========================
// Products
// =========================

router.get("/products", authMiddleware, controller.getProducts);
router.post("/products", authMiddleware, controller.createProduct);
router.put("/products/:id", authMiddleware, controller.updateProduct);
router.delete("/products/:id", authMiddleware, controller.deleteProduct);

// =========================
// Batches
// =========================

router.get("/batches", authMiddleware, controller.getBatches);
router.post("/batches", authMiddleware, controller.createBatch);
router.get("/batches/:id", authMiddleware, controller.getBatchById);

router.get(
  "/batches/:batchId/product-summary",
  authMiddleware,
  controller.getBatchProductSummary
);

router.get(
  "/batches/:batchId/items",
  authMiddleware,
  controller.getBatchItems
);

router.post("/batch-items", authMiddleware, controller.createBatchItem);

router.get(
  "/batches/:batchId/shipments",
  authMiddleware,
  controller.getShipments
);

router.put("/batches/:id", authMiddleware, controller.updateBatch);

// =========================
// Payments / Allocations
// =========================

router.get("/payments", authMiddleware, controller.getPayments);
router.post("/payments", authMiddleware, controller.createPayment);

router.put("/payments/:id", authMiddleware, controller.updatePayment);
router.delete("/payments/:id", authMiddleware, controller.deletePayment);

router.get("/allocations", authMiddleware, controller.getAllocations);
router.post("/allocations", authMiddleware, controller.createAllocation);

router.get(
  "/available-allocations",
  authMiddleware,
  controller.getAvailableAllocations
);

// =========================
// Shipments
// =========================

router.post("/shipments", authMiddleware, controller.createShipment);
router.delete("/shipments/:id", authMiddleware, controller.deleteShipment);

router.get(
  "/shipments/:shipmentId/allocations",
  authMiddleware,
  controller.getShipmentAllocations
);

router.post(
  "/shipment-allocations",
  authMiddleware,
  controller.createShipmentAllocation
);

router.delete(
  "/shipment-allocations/:id",
  authMiddleware,
  controller.deleteShipmentAllocation
);

router.put("/shipments/:id", authMiddleware, controller.updateShipment);

router.get(
  "/shipments/:shipmentId/items",
  authMiddleware,
  controller.getShipmentItems
);

router.post(
  "/shipments/:shipmentId/items",
  authMiddleware,
  controller.createShipmentItem
);

router.delete(
  "/shipment-items/:id",
  authMiddleware,
  controller.deleteShipmentItem
);

// =========================
// Documents
// =========================

router.get("/documents", authMiddleware, controller.getDocuments);

router.post(
  "/documents",
  authMiddleware,
  upload.single("file"),
  controller.createDocument
);

router.get("/documents/:id", authMiddleware, controller.getDocumentById);
router.delete("/documents/:id", authMiddleware, controller.deleteDocument);

module.exports = router;