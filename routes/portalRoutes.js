const express = require("express");

const router = express.Router();

const controller = require("../controllers/portalController");

router.get("/customers", controller.getCustomers);

router.post("/customers", controller.createCustomer);

router.get("/batches", controller.getBatches);
router.post("/batches", controller.createBatch);

module.exports = router;