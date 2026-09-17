function getAutoAssignUserId(intent) {
  if (intent === "support") return 3;
  if (intent === "sales") return 2;
  return null;
}

module.exports = {
  getAutoAssignUserId,
};
