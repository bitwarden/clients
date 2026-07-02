# Lock / Unlock

Lock or unlock the vault in a running Bitwarden client. Assumes a DevTools session is already
active (see the main `interact-client` SKILL.md for connecting).

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

To lock the vault from within the app, dispatch the `lockVault` message via the automation driver
(desktop only):

```js
async () => {
  await window.bitwardenAutomationDriver.sendMessage("lockVault");
};
```

For browser extension or web, click the **Lock** option in the account menu. Use `take_snapshot` to
locate the account/profile button, click it, then click the Lock item.

After locking, `wait_for` the lock screen to confirm the transition, then take a screenshot to
confirm the vault is locked before proceeding.

## Unlocking

The lock screen is implemented in
`libs/key-management-ui/src/lock/components/lock.component.ts`. It presents one active unlock
method at a time — biometrics, PIN, or master password — with tab-style controls to switch between
them.

### Unlock via biometrics

Biometric unlock uses the automation driver and is **desktop-only**. The app must have been
launched with `USE_AUTOMATION_BIOMETRICS=1`. See `references/biometrics.md` for the full driver
API.

1. Ensure the biometrics status is reported as available:

   ```js
   async () => {
     await window.bitwardenAutomationDriver.biometrics.setStatus(0);
   };
   ```

2. On the lock screen, locate and click the biometric unlock button (labeled "Use biometrics" or
   similar — use `take_snapshot` to find it by accessible name).

3. Confirm a request is queued:

   ```js
   async () => window.bitwardenAutomationDriver.biometrics.listPending();
   // returns [{ id, type: "authenticate" | "unlock", userId? }, ...]
   ```

4. Approve or deny the request:

   ```js
   // approve the oldest pending request
   async () => {
     await window.bitwardenAutomationDriver.biometrics.approve();
   };

   // or approve/deny by id
   async () => {
     await window.bitwardenAutomationDriver.biometrics.approve("1");
   };
   async () => {
     await window.bitwardenAutomationDriver.biometrics.deny("1");
   };
   ```

5. Screenshot to verify the vault unlocked.

> If `.biometrics` is undefined on the driver, the app was not launched with
> `USE_AUTOMATION_BIOMETRICS=1`. Ask the user to relaunch with that env var set.

> Mock biometric keys are held in memory only — they do not survive a `reloadProcess()` call.

### Unlock via PIN

1. Read the PIN from `.debug/credentials.txt` (default: `1234`).
2. On the lock screen, switch to the PIN tab if it is not already active — use `take_snapshot` to
   find the "Use PIN" or equivalent tab control and click it.
3. Fill the PIN input field with the value from `credentials.txt`.
4. Submit the form (click the Unlock button or press Enter).
5. Screenshot to verify the vault unlocked.

The PIN input field is a password-type input. The lock component calls
`unlockService.unlockWithPin(userId, pin)` on submission.

### Unlock via master password

1. Read the password from `.debug/credentials.txt`.
2. On the lock screen, switch to the master password tab if needed — use `take_snapshot` to find
   the "Use master password" tab and click it.
3. Fill the password input field with the value from `credentials.txt`.
4. Submit the form (click Unlock or press Enter).
5. Screenshot to verify the vault unlocked.

The lock component delegates master password entry to `MasterPasswordLockComponent`, which calls
`unlockService.unlockWithMasterPassword(userId, password)`.

## Source

- `libs/key-management-ui/src/lock/components/lock.component.ts`: lock screen component
- `libs/unlock/src/default-unlock.service.ts`: unlock service (PIN, password, biometrics)
- `apps/desktop/src/key-management/biometrics/automation-biometrics.service.ts`: mock biometrics
- `libs/automation-driver/src/automation-driver.service.ts`: automation driver
