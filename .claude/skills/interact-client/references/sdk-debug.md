# SDK debug capabilities

Read and drive **internal SDK state** that the public API does not expose — the
login method and the key store — from the running app. Backed by the SDK's
hand-rolled debug tree (`client.debug()`), surfaced on the automation driver as
`window.bitwardenAutomationDriver.debug`.

Dev-only. Available only when the app is backed by an `@bitwarden/sdk-internal`
built with the `debug-capabilities` feature (`crates/bitwarden-wasm-internal/build.sh -d`);
otherwise `client.debug()` is absent and calls throw. Wired on web, desktop, and
the CLI.

## Shape

`debug` exposes a single verb, `forUser(userId, fn)`. It resolves the per-user
SDK client, then runs your callback against that client's typed debug tree while
the client is held alive; only the callback's result escapes.

```js
async () => {
  const d = window.bitwardenAutomationDriver.debug;
  if (!d) return "debug capabilities unavailable — SDK not built with -d";
  // the vault must be unlocked; state is read from the per-user client.
};
```

Get the active user id (the verbs are user-scoped):

```js
async () => window.bitwardenAutomationDriver.state.readGlobal({
  stateName: "account",
  key: "activeAccountId",
});
```

The callback argument `d` is the typed debug tree, so `d.` autocompletes the
available nodes/capabilities in the console. **Do not stash `d`** (or anything
reached through it) for use after the callback returns — the client is freed once
`forUser` resolves.

## Login method

```js
async () => {
  const uid = await window.bitwardenAutomationDriver.state.readGlobal({
    stateName: "account", key: "activeAccountId",
  });
  return window.bitwardenAutomationDriver.debug.forUser(uid, (d) => d.auth().login_method());
};
// → { Username: { client_id, email, kdf: { pBKDF2: { iterations } } } }  (or undefined)
```

Overwrite it (debug-only; bypasses the login flow):

```js
async () => {
  const uid = await window.bitwardenAutomationDriver.state.readGlobal({
    stateName: "account", key: "activeAccountId",
  });
  await window.bitwardenAutomationDriver.debug.forUser(uid, (d) =>
    d.auth().set_login_method({
      Username: { client_id: "", email: "user@example.com", kdf: { pBKDF2: { iterations: 600000 } } },
    }),
  );
};
```

## Key store (redacted)

```js
async () => {
  const uid = await window.bitwardenAutomationDriver.state.readGlobal({
    stateName: "account", key: "activeAccountId",
  });
  return window.bitwardenAutomationDriver.debug.forUser(uid, (d) => d.key_store().list());
};
// → {
//   cipher_suite: "Standard",
//   security_state_version: 1,
//   backends: [
//     { name: "symmetric_keys", slots: [ { id: "User", material: "<redacted: ...>" }, ... ] },
//     { name: "private_keys",   slots: [ { id: "UserPrivateKey", material: "<redacted: ...>" } ] },
//     { name: "signing_keys",   slots: [] },
//   ],
// }
```

Key material is redacted unless the SDK is also built with the crypto
`dangerous-crypto-debug` feature.

## State registry (get/set/list)

`d.state()` is a generic browse over the SDK's state registry — both
client-managed and SDK-managed repositories — addressed by the repository's
string name and a string key.

```js
async () => {
  const uid = await window.bitwardenAutomationDriver.state.readGlobal({
    stateName: "account", key: "activeAccountId",
  });
  return window.bitwardenAutomationDriver.debug.forUser(uid, async (d) => {
    const s = d.state();
    return {
      types: s.types(),                                   // ["Cipher","LocalUserDataKey","Send", ...]
      items: JSON.parse(await s.list("LocalUserDataKey")),// values (JSON string → parse)
      one: JSON.parse(await s.get("LocalUserDataKey", uid)),// by key ("null" if absent)
    };
  });
};
```

- `types()` → `string[]` (registered repository names).
- `list(type)` / `get(type, key)` return **JSON strings** — `JSON.parse` them. `list`
  is values only (the repository API lists values without keys).
- `set(type, key, value)` takes the value as a **JSON string** (`JSON.stringify` it).
  Debug-only; it writes raw JSON straight into the repository.
- Keys are parsed from the string via the key type's `FromStr` (e.g. a `UserId`
  is the uuid string). Unknown type or unparseable key → `null` / no-op.

Caveats: repositories only registered lazily (e.g. `Setting`) or bridged from the
TS client (e.g. `Cipher` on desktop) may not appear in `types()` or may be empty;
`list`/`get` return **raw, unredacted** JSON, so treat secret-bearing repos with care.

## Notes

- **Unlock first.** `login_method`/`key_store` read per-user state, so they are
  `undefined`/empty on a locked or userless client. See [lock.md](lock.md).
- Adding a new SDK debug capability requires **no clients change** — once it
  exists on the SDK's `debug()` tree, call it straight through the callback
  (`d.<new_thing>()`).

## CLI

The CLI attaches the same driver to the Node `global` (`global.bitwardenAutomationDriver.debug`).
There is no console, so launch the CLI with `node --inspect` (or `--inspect-brk`)
to expose a CDP endpoint, attach, and `evaluate` the same snippets against
`global.bitwardenAutomationDriver.debug` — the calls are identical to desktop/web.
