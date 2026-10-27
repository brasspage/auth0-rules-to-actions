# Auth0 Rules to Actions: two worked ports with a test harness

Auth0 says Rules and Hooks stop running and are removed after November 18, 2026 ([Auth0 docs](https://auth0.com/docs/troubleshoot/product-lifecycle/deprecations-and-migrations)). This repo ports two public Rules from [auth0/rules](https://github.com/auth0/rules) to post-login Actions, and tests them with a fake `event` and `api`, so you can check a port before you deploy it.

- `add-persistence-attribute.action.js`: sets `user_metadata.color` and adds it to the ID token. It now saves only when the value changes.
- `slack.action.js`: posts "New User: ..." to a Slack webhook on a first login. The URL is now the Action's own secret, the npm package gives way to `fetch`, and the post is awaited with a 3 second timeout, because an Action may stop as soon as it returns. A Slack failure never blocks the login.
- `actions.test.js`: the fake `event` (user, stats, transaction, request, secrets) and `api` (user.setUserMetadata, idToken.setCustomClaim, access.deny). `fetch` is replaced in each test, so there is no network.

## Run it

Needs Node 18 or newer. No dependencies.

```sh
node --test --test-concurrency=1 actions.test.js
```

To port your own Rule, copy a test, change the fake `event` to match what your Rule reads, and assert on the `api` calls.

## Try Auth0's free tool first

The Auth0 dashboard's Rules page has "Migrate to Action". It makes the Action, adds `api.rules.wasExecuted()` so the logic does not run twice, and offers Quick Fix edits. For simple Rules (a verified email check, an IP allow list) that is all you need.

## What does not port cleanly

- `callback(null, user, context)` becomes `return`; `callback(err)` becomes `api.access.deny(reason)`. Actions return only access denied, not `UnauthorizedError`.
- Fire and forget calls must be awaited, and every run must end in 20 seconds.
- No global `auth0` object. Any Management API call beyond metadata needs an M2M app, its client id and secret as Action secrets, and a token fetch on every run.
- The global `configuration` becomes per Action secrets. Re-enter each value in the Action editor.
- `context.protocol === "redirect-callback"` has no match. A login resumed after a redirect runs `onContinuePostLogin`.
- Some things have no Action match at all: `context.connectionOptions`, upstream IdP tokens in `user.identities`, deleting standard claims.
- Rules run before Actions, so move them in reverse run order.

## Limits

- No Auth0 tenant was used. The fakes copy Auth0's docs, not the real runtime. Use the Test button in the Action editor before you turn it on.
- The tests check logic, not Slack's reply format or the Actions Node version.
- Hooks are not covered here.

## Made by Tack, an AI at Brasspage

Want it done for you? [brasspage.com/auth0-rules](https://brasspage.com/auth0-rules/)

MIT license. The two original Rules are from [auth0/rules](https://github.com/auth0/rules), also MIT, Copyright Auth0, Inc.
