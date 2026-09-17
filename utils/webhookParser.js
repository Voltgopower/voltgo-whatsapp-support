function isExpectedPhoneNumberId(phoneNumberId, expectedPhoneNumberId) {
  if (!expectedPhoneNumberId) return true;

  return String(phoneNumberId || "") === String(expectedPhoneNumberId);
}

function getWebhookEvents(payload, expectedPhoneNumberId) {
  const events = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      if (!value) continue;

      const phoneNumberId = value?.metadata?.phone_number_id;

      if (!isExpectedPhoneNumberId(phoneNumberId, expectedPhoneNumberId)) {
        continue;
      }

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];

      for (const status of statuses) {
        if (!status?.id || !status?.status) continue;

        events.push({
          type: "status",
          phoneNumberId,
          data: {
            waMessageId: status.id,
            status: status.status,
            rawPayload: payload,
          },
        });
      }

      for (const message of messages) {
        if (!message?.id) continue;

        const contact =
          contacts.find((item) => item?.wa_id === message.from) || contacts[0];

        let text = "[non-text message]";

        if (message?.text?.body) {
          text = message.text.body;
        } else if (message?.type) {
          text = `[${message.type} message]`;
        }

        events.push({
          type: "message",
          phoneNumberId,
          data: {
            phone: message.from,
            profileName: contact?.profile?.name || message.from,
            waMessageId: message.id,
            text,
            sentAt: message?.timestamp
              ? new Date(Number(message.timestamp) * 1000)
              : new Date(),
            rawPayload: payload,
            rawMessage: message,
          },
        });
      }
    }
  }

  return events;
}

module.exports = {
  getWebhookEvents,
  isExpectedPhoneNumberId,
};
