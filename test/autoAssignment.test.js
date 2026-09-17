const test = require("node:test");
const assert = require("node:assert/strict");

const { getAutoAssignUserId } = require("../utils/autoAssignment");

test("maps known intents to the existing assignees", () => {
  assert.equal(getAutoAssignUserId("support"), 3);
  assert.equal(getAutoAssignUserId("sales"), 2);
});

test("unknown intent skips assignment without aborting message processing", () => {
  assert.equal(getAutoAssignUserId("unknown"), null);
  assert.equal(getAutoAssignUserId(undefined), null);
});
