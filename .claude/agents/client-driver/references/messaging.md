# Messaging / menubar (desktop)

`window.bitwardenAutomationDriver.sendMessage(command, data?)` dispatches an app message — the same
commands the native menubar sends. Call it via `mcp__electron-devtools-attach__evaluate_script`.

```js
() => {
  window.bitwardenAutomationDriver.sendMessage("openSettings");
};
```

`openSettings()` is a convenience wrapper for the message above:

```js
() => {
  window.bitwardenAutomationDriver.openSettings();
};
```

Use this to reach UI that is only accessible from the native menubar, which the DevTools protocol
cannot click.

## Related

- [feature-flags.md](feature-flags.md) — override feature flags and reload the process
- [biometrics.md](biometrics.md) — mock biometrics
