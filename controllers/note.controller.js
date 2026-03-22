const noteModel = require("../models/note.model");

async function listNotes(req, res) {
  try {
    const customerId = Number(req.params.customerId);

    if (!customerId || Number.isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id",
      });
    }

    const notes = await noteModel.listNotesByCustomerId(customerId);

    return res.json({
      success: true,
      notes,
    });
  } catch (error) {
    console.error("listNotes error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function createNote(req, res) {
  try {
    const customerId = Number(req.params.customerId);
    const { content, created_by } = req.body;

    const note = content;

    if (!customerId || Number.isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id",
      });
    }

    if (!note || !String(note).trim()) {
      return res.status(400).json({
        success: false,
        message: "Note is required",
      });
    }

    const newNote = await noteModel.createNote({
      customerId,
      note: String(note).trim(),
      createdBy: created_by || "Bruce",
    });

    return res.json({
      success: true,
      note: newNote,
    });
  } catch (error) {
    console.error("createNote error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function deleteNote(req, res) {
  try {
    const noteId = Number(req.params.noteId);

    if (!noteId || Number.isNaN(noteId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid note id",
      });
    }

    const deleted = await noteModel.deleteNote(noteId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    return res.json({
      success: true,
      note: deleted,
    });
  } catch (error) {
    console.error("deleteNote error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  listNotes,
  createNote,
  deleteNote,
};
