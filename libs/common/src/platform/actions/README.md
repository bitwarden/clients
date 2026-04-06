# Platform Actions API

## ActionsService.openPopup()

This document outlines the current behavior of `ActionsService.openPopup()` across different browsers, specifically in two contexts:

- **Window Context**: When the call is triggered from an active browser window (e.g., from a tab's script).
- **Background Service Worker Context**: When the call is made from a background context, such as a service worker.

The `openPopup()` method has limitations in some environments due to browser-specific restrictions or bugs. Below is a compatibility chart detailing the observed behavior.

---

## Compatibility Table

| Browser | Window Context      | Background Service Worker Context |
| ------- | ------------------- | --------------------------------- |
| Safari  | ✅ Works            | ❌ Fails                          |
| Firefox | ❌ Fails            | ❌ Fails                          |
| Chrome  | ✅ Works            | ✅ Works                          |
| Edge    | 🟡 Untested         | 🟡 Untested                       |
| Vivaldi | ⚠️ Ambiguous (Bug?) | ⚠️ Ambiguous (Bug?)               |
| Opera   | ✅ Works            | ❌ Fails silently                 |

---

## Notes

- **Safari**: Only works when `openPopup()` is triggered from a window context. Attempts from background service workers fail.
- **Firefox**: Does not appear to support `openPopup()` in either context.
- **Chrome**: Fully functional in both contexts, but only on Mac. Windows it does not work in.
- **Edge**: Behavior has not been tested.
- **Vivaldi**: `openPopup()` results in an error that _might_ be related to running in a background context, but the cause is currently unclear.
- **Opera**: Works from window context. Background calls fail silently with no error message.

---

## Summary

When implementing `ActionsService.openPopup()`, prefer triggering it from a window context whenever possible to maximize cross-browser compatibility. Full background service worker support is only reliable in **Chrome**.
