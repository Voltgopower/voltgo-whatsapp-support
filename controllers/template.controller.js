const db = require("../config/db");

async function listTemplates(req, res) {
  try {
    const role = req.user?.role || "sales";

    let sql = `
      SELECT *
      FROM templates
      WHERE is_active = true
    `;

    if (role === "sales") {
      sql += ` AND role_scope IN ('sales', 'all')`;
    } else if (role === "support") {
      sql += ` AND role_scope IN ('support', 'all')`;
    }

    sql += ` ORDER BY category, template_name`;

    const result = await db.query(sql);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("listTemplates error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load templates",
    });
  }
}

module.exports = {
  listTemplates,
};