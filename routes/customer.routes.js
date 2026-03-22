const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer.controller");

router.get("/:id", customerController.getCustomerById);
router.patch("/:id/notes", customerController.updateCustomerNotes);

router.get("/:id/tags", customerController.getCustomerTags);
router.post("/:id/tags", customerController.addCustomerTag);
router.delete("/:id/tags", customerController.removeCustomerTag);

module.exports = router;
