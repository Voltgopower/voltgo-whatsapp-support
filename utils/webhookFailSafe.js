const fs = require("fs");
const path = require("path");

const BASE_DIR = path.join(__dirname, "..", "storage", "webhook-failsafe");

function ensureDir() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

function getDailyFilePath(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return path.join(BASE_DIR, `${yyyy}-${mm}-${dd}.jsonl`);
}

function appendJsonLine(data) {
  ensureDir();
  const filePath = getDailyFilePath();
  fs.appendFileSync(filePath, JSON.stringify(data) + "\n", "utf8");
  return filePath;
}

function saveWebhookReceived(payload) {
  const record = {
    type: "received",
    receivedAt: new Date().toISOString(),
    payload,
  };

  return appendJsonLine(record);
}

function saveWebhookFailure(payload, error) {
  const record = {
    type: "failed",
    receivedAt: new Date().toISOString(),
    error: {
      message: error?.message || "Unknown error",
      code: error?.code || null,
      stack: error?.stack || null,
    },
    payload,
  };

  return appendJsonLine(record);
}

module.exports = {
  saveWebhookReceived,
  saveWebhookFailure,
};