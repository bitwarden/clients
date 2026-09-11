# Override feature flags (desktop)

Use the dev-only automation driver to override feature flags on the running desktop app. The driver
exposes capabilities by name — there are no direct properties on it. Get the `featureFlags`
capability and call it via `mcp__electron-devtools-attach__evaluate_script`.

Flag keys are the string **values** of the `FeatureFlag` enum in
`libs/common/src/enums/feature-flag.enum.ts` — **not** the enum member name. Read the enum to get
the exact key before toggling.

```js
async () => {
  await window.bitwardenAutomationDriver.get("featureFlags").set("windows-desktop-autotype", true);
};
async () => window.bitwardenAutomationDriver.get("featureFlags").get("windows-desktop-autotype");
async () => {
  await window.bitwardenAutomationDriver.get("featureFlags").clear("windows-desktop-autotype");
};
async () => {
  await window.bitwardenAutomationDriver.get("featureFlags").clearAll();
};
```

| Method             | Effect                              |
| ------------------ | ----------------------------------- |
| `set(flag, value)` | Override a flag                     |
| `get(flag)`        | Current (possibly overridden) value |
| `clear(flag)`      | Drop one override                   |
| `clearAll()`       | Drop every override                 |

## Reload after changing a flag

Overrides persist in global state. Many flags are only read at startup — after changing a flag,
reload the process via the `processReload` capability:

```js
async () => {
  await window.bitwardenAutomationDriver.get("processReload").reload();
};
```

After the reload, call `mcp__electron-devtools-attach__list_pages` → `select_page` before further
interaction.
