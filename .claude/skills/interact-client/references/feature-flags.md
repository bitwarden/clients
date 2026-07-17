# Override feature flags (desktop)

Use the dev-only automation driver to override feature flags on the running desktop app. Call its
methods via `mcp__electron-devtools__evaluate_script`. Always guard for the driver's presence — if
`window.bitwardenAutomationDriver` is undefined, the build is not in dev mode.

Flag keys are the string **values** of the `FeatureFlag` enum in
`libs/common/src/enums/feature-flag.enum.ts` — **not** the enum member name. Read the enum to get
the exact key before toggling.

```js
async () => {
  await window.bitwardenAutomationDriver.setFeatureFlag("windows-desktop-autotype", true);
};
async () => window.bitwardenAutomationDriver.getFeatureFlag("windows-desktop-autotype");
async () => {
  await window.bitwardenAutomationDriver.clearFeatureFlag("windows-desktop-autotype");
};
async () => {
  await window.bitwardenAutomationDriver.clearAllFeatureFlagOverrides();
};
```

## Reload after changing a flag

Overrides persist in global state. Many flags are only read at startup — after changing a flag,
reload the process:

```js
async () => {
  await window.bitwardenAutomationDriver.reloadProcess();
};
```

After `reloadProcess`, call `mcp__electron-devtools__list_pages` → `select_page` before further
interaction.

## Source

- `libs/common/src/enums/feature-flag.enum.ts`: `FeatureFlag` enum — read this for exact flag keys
- `libs/automation-driver/src/automation-driver.service.ts`: `AutomationDriver` implementation
