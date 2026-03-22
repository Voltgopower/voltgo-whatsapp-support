const noteModel = require("../models/customerNote.model");

async function getNotes(req, res) {
  try {
    const customerId = req.params.id;

    const notes = await noteModel.getNotesByCustomerId(customerId);

    res.json({
      success: true,
      notes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
}

async function createNote(req, res) {
  try {
    const customerId = req.params.id;
    const { content } = req.body;

    const note = await noteModel.createNote({
      customerId,
      content,
      createdBy: "Bruce",
    });

    res.json({
      success: true,
      note,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
}

module.exports = {
  getNotes,
  createNote,
};
