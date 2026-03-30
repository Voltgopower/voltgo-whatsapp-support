function detectIntent(text = "") {
  const t = String(text || "").toLowerCase().trim();

  if (t.includes("sales request")) {
    return { intent: "sales", salesHits: 999, supportHits: 0 };
  }

  if (t.includes("support request")) {
    return { intent: "support", salesHits: 0, supportHits: 999 };
  }

  const salesKeywords = [
    "price",
    "pricing",
    "quote",
    "cost",
    "how much",
    "discount",
    "wholesale",
    "bulk",
    "buy",
    "purchase",
    "order",
    "battery",
    "batteries",
    "12v",
    "24v",
    "48v",
    "51.2v",
    "100ah",
    "200ah",
    "300ah",
    "400ah",
    "lifepo4",
    "spec",
    "specs",
    "capacity",
    "model",
    "shipping",
    "delivery",
    "lead time",
    "available",
    "availability",
    "stock",
    "voltage",
  ];

  const supportKeywords = [
    "problem",
    "issue",
    "error",
    "not working",
    "doesn't work",
    "doesnt work",
    "failed",
    "damaged",
    "broken",
    "warranty",
    "replace",
    "replacement",
    "refund",
    "return",
    "defective",
    "support",
    "install",
    "installation",
    "can't",
    "cannot",
    "can not",
    "fault",
    "repair",
  ];

  let salesHits = 0;
  let supportHits = 0;

  for (const k of salesKeywords) {
    if (t.includes(k)) salesHits++;
  }

  for (const k of supportKeywords) {
    if (t.includes(k)) supportHits++;
  }

  let intent = "unknown";

  if (salesHits > supportHits && salesHits > 0) {
    intent = "sales";
  } else if (supportHits > salesHits && supportHits > 0) {
    intent = "support";
  }

  return { intent, salesHits, supportHits };
}

module.exports = { detectIntent };