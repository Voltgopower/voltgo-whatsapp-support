const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const BASE_DIR = path.join(__dirname, "..", "storage", "webhook-failsafe");

function getTodayFile() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return path.join(BASE_DIR, `${yyyy}-${mm}-${dd}.jsonl`);
}

router.get("/webhook", (req, res) => {
  try {
    const filePath = getTodayFile();

    if (!fs.existsSync(filePath)) {
      return res.send(`
        <html>
          <head>
            <title>Webhook Debug</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
            </style>
          </head>
          <body>
            <h2>Webhook Debug</h2>
            <p>No webhook log file found for today.</p>
          </body>
        </html>
      `);
    }

    const lines = fs.readFileSync(filePath, "utf8")
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    const records = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(-50)
      .reverse();

    const html = records.map((record, index) => {
      return `
        <div style="border:1px solid #ccc; border-radius:8px; padding:12px; margin-bottom:12px;">
          <div><strong>#${index + 1}</strong></div>
          <div><strong>Type:</strong> ${record.type || ""}</div>
          <div><strong>Received At:</strong> ${record.receivedAt || ""}</div>
          <pre style="white-space: pre-wrap; word-break: break-word; background:#f6f6f6; padding:10px; border-radius:6px;">${escapeHtml(JSON.stringify(record, null, 2))}</pre>
        </div>
      `;
    }).join("");

    return res.send(`
      <html>
        <head>
          <title>Webhook Debug</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              background: #fafafa;
            }
            h2 {
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <h2>Webhook Debug Dashboard</h2>
          <p>Showing latest ${records.length} records from today's fail-safe log.</p>
          ${html || "<p>No records found.</p>"}
        </body>
      </html>
    `);
  } catch (error) {
    console.error("debug webhook route error:", error);
    return res.status(500).send("Debug route error: " + error.message);
  }
});

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = router;