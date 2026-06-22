# Auto-Test Plan — Desktop PIN lock mode

Run ID: `20260622-192718`
Branch: `km/auto-test`

## Main change

The desktop Account Security settings previously let you only enable/disable "Unlock with PIN".
The PIN lock mode (whether the master password is required on app restart) could be chosen **only**
once, inside the Set-PIN dialog, with no way to change it afterward — unlike the browser client,
which exposes a persistent "Lock with master password on restart" checkbox.

This change adds the same `pinLockWithMasterPassword` checkbox to the desktop settings dialog:

- New form control `pinLockWithMasterPassword`, initialized from
  `PinService.getPinLockType()` (`AfterFirstUnlock` → checked).
- Toggling it calls `PinService.setPin(pin, AfterFirstUnlock|BeforeFirstUnlock, userId)` so the
  lock mode can be changed without removing/re-adding the PIN.
- The checkbox is shown only when a PIN is set and the user has a master password.

## Observable behavior to confirm

1. With a PIN enabled and a master password, a **"Lock with master password on restart"** checkbox
   appears (indented) below "Unlock with PIN" in Settings → Security.
2. Toggling the checkbox persists without error (no console errors), and reflects the current
   lock type.

## Screencast note

Start a Chrome DevTools MCP screencast before opening Settings; stop it after toggling the checkbox.

## Navigation steps

1. Launch desktop dev build, attach to renderer on :9222.
2. Unlock vault (default PIN `1234`) if locked.
3. Inject `bitwardenMessagingService.sendMessage({ command: "openSettings" })`.
4. Confirm Security tab shows the new checkbox under "Unlock with PIN".
5. Toggle the checkbox, capture screenshots, check console for errors.
