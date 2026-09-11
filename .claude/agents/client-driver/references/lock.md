# Lock / Unlock

Lock or unlock the vault in a running Bitwarden client. Assumes a DevTools session is already
active (see the client-driver agent instructions for connecting).

## The lock capability

The automation driver exposes capabilities by name — there are no direct properties on the driver.
Get the lock capability with `get("lock")` and call it via
`mcp__electron-devtools-attach__evaluate_script`:

```js
async () => {
  const lock = window.bitwardenAutomationDriver.get("lock");
  return await lock.listUsers();
};
// [{ userId: "…", email: "user@example.com", status: "Unlocked" }, ...]
```

`status` is an `AuthenticationStatus` name: `LoggedOut`, `Locked`, or `Unlocked`. Every other method
takes a `userId`, so start with `listUsers()` to pick the account you mean.

| Method                                       | Effect                                    |
| -------------------------------------------- | ----------------------------------------- |
| `listUsers()`                                | Lock status of every known account        |
| `lock(userId)`                               | Lock, as if the user locked it themselves |
| `unlockWithMasterPassword(userId, password)` | Unlock with the master password           |
| `unlockWithPin(userId, pin)`                 | Unlock with the PIN                       |
| `unlockWithBiometrics(userId)`               | Unlock via biometrics                     |

Defined in `libs/automation-driver/src/capabilities/lock.ts` and registered in
`libs/angular/src/services/jslib-services.module.ts`, so it is available on desktop, browser
extension, and web — use the MCP prefix that matches your target.

## Credentials

Read credentials from `.debug/credentials.txt` before any unlock flow. The file uses `KEY=VALUE`
format:

```
PIN=1234
PASSWORD=yourpassword
```

- **PIN**: default is `1234`; always read the actual value from `credentials.txt`.
- **Password**: always read from `credentials.txt`; no hardcoded default.

## Locking

```js
async () => {
  const lock = window.bitwardenAutomationDriver.get("lock");
  const [user] = await lock.listUsers();
  await lock.lock(user.userId);
};
```

To exercise the UI path instead, click the **Lock** option in the account menu: use
`take_snapshot` to locate the account/profile button, click it, then click the Lock item.

After locking, `wait_for` the lock screen to confirm the transition, then take a screenshot to
confirm the vault is locked before proceeding.

## Unlocking

Prefer the capability when you only need the vault open — it skips the lock screen entirely and
fails loudly instead of leaving you guessing at a snapshot:

```js
async () => {
  const lock = window.bitwardenAutomationDriver.get("lock");
  const [user] = await lock.listUsers();
  await lock.unlockWithPin(user.userId, "1234"); // or unlockWithMasterPassword(userId, password)
};
```

Drive the **lock screen UI** instead when the lock screen itself is what you are testing. It is
implemented in `libs/key-management-ui/src/lock/components/lock.component.ts` and presents one
active unlock method at a time — biometrics, PIN, or master password — with tab-style controls to
switch between them. Use `take_snapshot` to find the tab control ("Use PIN", "Use master password",
"Use biometrics"), click it, fill the input, submit, then screenshot to verify.

### Unlock via biometrics

Biometric unlock is **desktop-only** and the app must have been launched with
`USE_AUTOMATION_BIOMETRICS=1`. See
`.claude/agents/client-driver/references/biometrics.md` for the full capability API.

1. Report biometrics as available, then start the unlock:

   ```js
   async () => {
     const driver = window.bitwardenAutomationDriver;
     const biometrics = driver.get("biometrics");
     const lock = driver.get("lock");

     await biometrics.setStatus(0);

     const [user] = await lock.listUsers();
     lock.unlockWithBiometrics(user.userId); // do not await — it blocks on the prompt
     return await biometrics.listPending();
   };
   ```

2. Approve (or deny) the queued request:

   ```js
   async () => {
     const biometrics = window.bitwardenAutomationDriver.get("biometrics");
     await biometrics.approve(); // oldest pending; or approve(id) / deny(id)
   };
   ```

3. `listUsers()` again and confirm the account reads `Unlocked`, then screenshot.

> Mock biometric keys are held in memory only — they do not survive a process reload.

## Source

- `libs/automation-driver/src/capabilities/lock.ts`: `LockCapability` — the methods above
- `libs/automation-driver/src/automation-driver.service.ts`: `get(name)` / `list()` lookup
- `libs/key-management-ui/src/lock/components/lock.component.ts`: lock screen component
- `libs/unlock/src/default-unlock.service.ts`: unlock service the capability delegates to
- `apps/desktop/src/key-management/biometrics/automation-biometrics.service.ts`: mock biometrics
