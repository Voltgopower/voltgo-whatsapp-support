const express = require("express");
const router = express.Router();
const noteController = require("../controllers/note.controller");

router.get("/:customerId/notes", noteController.listNotes);
router.post("/:customerId/notes", noteController.createNote);
router.delete("/notes/:noteId", noteController.deleteNote);

module.exports = router;
