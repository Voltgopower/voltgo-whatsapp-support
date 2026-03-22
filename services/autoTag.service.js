const { detectTagsFromText } = require("../utils/autoTag");
const customerModel = require("../models/customer.model");

async function applyAutoTagsForMessage(customerId, messageText) {
  const tags = detectTagsFromText(messageText);

  for (const tag of tags) {
    await customerModel.addTagToCustomer(customerId, tag);
  }

  return tags;
}

module.exports = {
  applyAutoTagsForMessage,
};
