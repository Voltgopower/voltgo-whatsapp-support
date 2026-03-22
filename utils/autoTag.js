function detectTagsFromText(text = "") {
  const t = String(text).toLowerCase();
  const tags = new Set();

  // refund
  if (
    t.includes("refund") ||
    t.includes("money back") ||
    t.includes("return")
  ) {
    tags.add("refund");
  }

  // replacement
  if (
    t.includes("replace") ||
    t.includes("replacement") ||
    t.includes("swap")
  ) {
    tags.add("replacement");
  }

  // warranty / product issue
  if (
    t.includes("not working") ||
    t.includes("cannot start") ||
    t.includes("can't start") ||
    t.includes("won't start") ||
    t.includes("battery issue") ||
    t.includes("defective") ||
    t.includes("faulty") ||
    t.includes("broken")
  ) {
    tags.add("warranty");
  }

  // logistics
  if (
    t.includes("tracking") ||
    t.includes("shipping") ||
    t.includes("delivery") ||
    t.includes("where is my order") ||
    t.includes("late delivery")
  ) {
    tags.add("logistics");
  }

  // sales
  if (
    t.includes("price") ||
    t.includes("quote") ||
    t.includes("wholesale") ||
    t.includes("bulk order") ||
    t.includes("dealer")
  ) {
    tags.add("sales");
  }

  // urgent
  if (
    t.includes("urgent") ||
    t.includes("asap") ||
    t.includes("immediately") ||
    t.includes("right now")
  ) {
    tags.add("urgent");
  }

  return Array.from(tags);
}

module.exports = {
  detectTagsFromText,
};
