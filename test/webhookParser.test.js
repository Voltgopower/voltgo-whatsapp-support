const test = require("node:test");
const assert = require("node:assert/strict");

const { getWebhookEvents } = require("../utils/webhookParser");

const EXPECTED_PHONE_NUMBER_ID = "926427580563078";

function changeFor(phoneNumberId, value = {}) {
  return {
    field: "messages",
    value: {
      messaging_product: "whatsapp",
      metadata: { phone_number_id: phoneNumberId },
      ...value,
    },
  };
}

test("filters events from a different WhatsApp phone number", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          changeFor("another-number", {
            messages: [
              { id: "wrong-1", from: "100", type: "text", text: { body: "no" } },
            ],
          }),
          changeFor(EXPECTED_PHONE_NUMBER_ID, {
            messages: [
              { id: "right-1", from: "200", type: "text", text: { body: "yes" } },
            ],
          }),
        ],
      },
    ],
  };

  const events = getWebhookEvents(payload, EXPECTED_PHONE_NUMBER_ID);

  assert.equal(events.length, 1);
  assert.equal(events[0].data.waMessageId, "right-1");
});

test("extracts every message across all entries and changes", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          changeFor(EXPECTED_PHONE_NUMBER_ID, {
            contacts: [
              { wa_id: "100", profile: { name: "Alice" } },
              { wa_id: "200", profile: { name: "Bob" } },
            ],
            messages: [
              { id: "m1", from: "100", timestamp: "1700000000", type: "text", text: { body: "one" } },
              { id: "m2", from: "200", timestamp: "1700000001", type: "text", text: { body: "two" } },
            ],
          }),
        ],
      },
      {
        changes: [
          changeFor(EXPECTED_PHONE_NUMBER_ID, {
            messages: [
              { id: "m3", from: "300", type: "image", image: { id: "image-1" } },
            ],
          }),
        ],
      },
    ],
  };

  const events = getWebhookEvents(payload, EXPECTED_PHONE_NUMBER_ID);

  assert.deepEqual(
    events.map((event) => event.data.waMessageId),
    ["m1", "m2", "m3"]
  );
  assert.equal(events[0].data.profileName, "Alice");
  assert.equal(events[1].data.profileName, "Bob");
  assert.equal(events[2].data.text, "[image message]");
});

test("extracts every status and message when they share a payload", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          changeFor(EXPECTED_PHONE_NUMBER_ID, {
            statuses: [
              { id: "s1", status: "delivered" },
              { id: "s2", status: "read" },
            ],
            messages: [
              { id: "m1", from: "100", type: "text", text: { body: "hello" } },
            ],
          }),
        ],
      },
    ],
  };

  const events = getWebhookEvents(payload, EXPECTED_PHONE_NUMBER_ID);

  assert.deepEqual(
    events.map((event) => `${event.type}:${event.data.waMessageId}`),
    ["status:s1", "status:s2", "message:m1"]
  );
});

test("does not enforce a phone filter when the environment value is absent", () => {
  const payload = {
    entry: [
      {
        changes: [
          changeFor("local-number", {
            messages: [
              { id: "local-1", from: "100", type: "text", text: { body: "test" } },
            ],
          }),
        ],
      },
    ],
  };

  assert.equal(getWebhookEvents(payload).length, 1);
});
