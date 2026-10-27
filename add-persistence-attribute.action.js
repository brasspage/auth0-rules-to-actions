// Port of auth0/rules src/rules/add-persistence-attribute.js (MIT, read as text, Oct 27, 2026) to a
// post-login Action. Rule: set user_metadata.color, add it to the ID token, save with auth0.users.
// Action: no global auth0 object; api.user.setUserMetadata is batched into one save at the end of the flow.
exports.onExecutePostLogin = async (event, api) => {
  const color = event.user.user_metadata?.color || "blue";
  if (event.user.user_metadata?.color !== color)
    api.user.setUserMetadata("color", color); // Rule saved every login; we save only when it changes
  api.idToken.setCustomClaim("https://example.com/favorite_color", color);
};
