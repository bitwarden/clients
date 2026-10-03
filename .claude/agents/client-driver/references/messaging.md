# Menubar navigation (desktop)

Desktop-only. The `desktopNavigation` capability reaches UI that is only accessible from the native
menubar, which the DevTools protocol cannot click. Call it via
`mcp__electron-devtools-attach__evaluate_script`:

```js
() => {
  window.bitwardenAutomationDriver.get("desktopNavigation").openSettings();
};
```

`openSettings()` is synchronous — it posts the same app message the menubar sends and returns
immediately, so `wait_for` the settings UI before interacting with it.

There is no generic message-dispatch method on the driver; `openSettings()` is the only navigation
method exposed.

## Related

- [feature-flags.md](feature-flags.md) — override feature flags and reload the process
- [biometrics.md](biometrics.md) — mock biometrics
