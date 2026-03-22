require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { receiveWebhook } = require("../controllers/webhook.controller");

const BASE_DIR = path.join(__dirname, "..", "storage", "webhook-failsafe");

function getTodayFile() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return path.join(BASE_DIR, `${yyyy}-${mm}-${dd}.jsonl`);
}

function parseJsonLines(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

async function replay() {
  const file = getTodayFile();

  if (!fs.existsSync(file)) {
    console.log("No fail-safe file found.");
    return;
  }

  console.log("Reading:", file);

  const records = parseJsonLines(file);

  const failed = records.filter((r) => r.type === "failed");

  console.log("Failed records:", failed.length);

  for (const record of failed) {
    const payload = record.payload;

    const req = {
      body: payload,
    };

    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(data) {
        console.log("Replay success:", data);
      },
      sendStatus(code) {
        console.log("Replay sendStatus:", code);
      },
    };

    try {
      await receiveWebhook(req, res);
    } catch (err) {
      console.error("Replay error:", err.message);
    }
  }
}

replay();