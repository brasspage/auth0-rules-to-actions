// Port of auth0/rules src/rules/slack.js (MIT, read as text, Oct 27, 2026) to a post-login Action.
// Rule: on a first login, post "New User: ..." to a Slack webhook with slack-notify, without waiting.
// Action: the URL moves from the global `configuration` to this Action's own secret, the npm package
// gives way to the runtime's fetch, and the call is awaited (with a timeout) because an Action may be
// frozen as soon as it returns. A Slack failure is logged and never blocks the login, as before.
exports.onExecutePostLogin = async (event, api) => {
  if (
    event.stats.logins_count > 1 ||
    event.transaction?.protocol === "oauth2-refresh-token" ||
    event.request.query?.prompt === "none"
  )
    return; // "redirect-callback" is gone: a resumed login runs onContinuePostLogin, not this
  const hook = event.secrets.SLACK_HOOK_URL;
  if (!hook) return console.log("Missing required configuration. Skipping.");
  const text = `New User: ${event.user.name || event.user.email} (${event.user.email})`;
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, channel: "#some_channel" }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    console.log(`Slack post failed: ${e.message}`);
  }
};
