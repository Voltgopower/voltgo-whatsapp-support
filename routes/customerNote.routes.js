const express = require("express");
const router = express.Router();

const controller = require("../controllers/customerNote.controller");

router.get("/:id/notes", controller.getNotes);

router.post("/:id/notes", controller.createNote);

module.exports = router;
