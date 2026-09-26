# Desktop mock biometrics

Desktop-only. Only present when the app was launched with `USE_AUTOMATION_BIOMETRICS=1`. Replaces
the OS biometric prompt with a fake service so prompts can be approved or denied deterministically.
Access via the `biometrics` capability: `window.bitwardenAutomationDriver.get("biometrics")`. The
capability is registered on every desktop build, but the main-process IPC handler behind it is only
wired up in dev mode with the env var set — without it, calls reject with "No handler registered".

## Set the reported status

From `BiometricsStatus` in `libs/key-management/src/biometrics/biometrics-status.ts`:

| Value | Status                | Meaning                             |
| ----- | --------------------- | ----------------------------------- |
| 0     | `Available`           | Biometric unlock available          |
| 1     | `UnlockNeeded`        | Password must unlock user key first |
| 2     | `HardwareUnavailable` | No biometric hardware               |
| 5     | `PlatformUnsupported` | Not implemented for this platform   |

```js
async () => {
  await window.bitwardenAutomationDriver.get("biometrics").setStatus(0);
};
```

## Approve / deny prompts

```js
// list queued requests — [{ id, type: "authenticate" | "unlock", userId? }, ...]
async () => window.bitwardenAutomationDriver.get("biometrics").listPending();

// approve / deny by id, or omit id to resolve the oldest pending request
async () => {
  await window.bitwardenAutomationDriver.get("biometrics").approve("1");
};
async () => {
  await window.bitwardenAutomationDriver.get("biometrics").deny();
};
```

## Typical biometric-unlock flow

1. `setStatus(0)` — report biometrics as available.
2. Click the biometric unlock button via `mcp__electron-devtools-attach__click`.
3. `listPending()` — confirm a request is queued.
4. `approve(id)` or `deny(id)` — simulate the user's response.
5. Screenshot to verify the result.

## Source

- `apps/desktop/src/key-management/biometrics/automation-biometrics.service.ts`: mock biometrics
  implementation
- `libs/key-management/src/biometrics/biometrics-status.ts`: `BiometricsStatus` values
- `libs/automation-driver/src/capabilities/biometrics.ts`: `BiometricsCapability` — the methods above
