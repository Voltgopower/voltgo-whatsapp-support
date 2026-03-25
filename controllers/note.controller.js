const noteModel = require("../models/note.model");

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

async function listNotes(req, res) {
  try {
    const customerId = String(req.params.customerId || "").trim();

    if (!customerId || !isValidUuid(customerId)) {
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
    const customerId = String(req.params.customerId || "").trim();
    const { content, created_by } = req.body || {};

    const note = String(content || "").trim();

    if (!customerId || !isValidUuid(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id",
      });
    }

    if (!note) {
      return res.status(400).json({
        success: false,
        message: "Note is required",
      });
    }

    const newNote = await noteModel.createNote({
      customerId,
      note,
      createdBy: String(created_by || "Bruce").trim(),
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
    const noteId = String(req.params.noteId || "").trim();

    if (!noteId || !isValidUuid(noteId)) {
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
