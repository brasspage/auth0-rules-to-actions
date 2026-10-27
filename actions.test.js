// Run: node --test --test-concurrency=1 actions.test.js
// Two public Auth0 Rules ported to Actions, checked with a fake `event` and `api`.
// No Auth0 tenant and no network: fetch is replaced in each test.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const persist = require("./add-persistence-attribute.action.js");
const slack = require("./slack.action.js");

// The parts of the post-login event and api these Actions read or call (names from Auth0's docs).
function fake(over = {}) {
  const calls = { meta: [], claims: {}, denied: null };
  const event = {
    user: {
      user_id: "auth0|1",
      email: "a@example.com",
      name: "Ann",
      user_metadata: {},
      ...over.user,
    },
    stats: { logins_count: 1, ...over.stats },
    transaction: { protocol: "oidc-basic-profile", ...over.transaction },
    request: { ip: "203.0.113.5", query: {}, ...over.request },
    secrets: { ...over.secrets },
  };
  const api = {
    user: { setUserMetadata: (k, v) => calls.meta.push([k, v]) },
    idToken: { setCustomClaim: (k, v) => (calls.claims[k] = v) },
    access: { deny: (r) => (calls.denied = r) },
  };
  return { event, api, calls };
}

test("persistence: a new user gets blue, saved once, in the ID token", async () => {
  const { event, api, calls } = fake();
  await persist.onExecutePostLogin(event, api);
  assert.deepStrictEqual(calls.meta, [["color", "blue"]]);
  assert.strictEqual(
    calls.claims["https://example.com/favorite_color"],
    "blue",
  );
});

test("persistence: a saved color is kept and not saved again", async () => {
  const { event, api, calls } = fake({
    user: { user_metadata: { color: "red" } },
  });
  await persist.onExecutePostLogin(event, api);
  assert.deepStrictEqual(calls.meta, []);
  assert.strictEqual(calls.claims["https://example.com/favorite_color"], "red");
});

async function withFetch(impl, fn) {
  const real = global.fetch;
  const sent = [];
  global.fetch = async (url, init) => (
    sent.push({ url, body: JSON.parse(init.body) }),
    impl()
  );
  try {
    await fn(sent);
  } finally {
    global.fetch = real;
  }
}

test("slack: first login posts the message to the secret's URL, and waits for it", async () => {
  await withFetch(
    () => ({ ok: true }),
    async (sent) => {
      const { event, api, calls } = fake({
        secrets: { SLACK_HOOK_URL: "https://hooks.example.test/x" },
      });
      await slack.onExecutePostLogin(event, api);
      assert.strictEqual(sent.length, 1);
      assert.strictEqual(sent[0].url, "https://hooks.example.test/x");
      assert.strictEqual(sent[0].body.text, "New User: Ann (a@example.com)");
      assert.strictEqual(calls.denied, null);
    },
  );
});

test("slack: no post on later logins, refresh tokens, prompt=none, or with no secret", async () => {
  await withFetch(
    () => ({ ok: true }),
    async (sent) => {
      const s = { SLACK_HOOK_URL: "https://hooks.example.test/x" };
      for (const over of [
        { secrets: s, stats: { logins_count: 2 } },
        { secrets: s, transaction: { protocol: "oauth2-refresh-token" } },
        { secrets: s, request: { query: { prompt: "none" } } },
        {},
      ]) {
        const { event, api } = fake(over);
        await slack.onExecutePostLogin(event, api);
      }
      assert.strictEqual(sent.length, 0);
    },
  );
});

test("slack: a Slack failure never blocks the login", async () => {
  await withFetch(
    () => {
      throw new Error("down");
    },
    async () => {
      const { event, api, calls } = fake({
        secrets: { SLACK_HOOK_URL: "https://hooks.example.test/x" },
      });
      await slack.onExecutePostLogin(event, api);
      assert.strictEqual(calls.denied, null);
    },
  );
});
