# managed-settings

Owned by: platform

Administrator-forced client settings acquired from operating system device-management (UEM/MDM) channels

## Where the profile lives

The SDK's `ManagedSettingsClient` normalizes and holds the active profile. `ManagedSettingsService`
reads through that handle, so until the SDK has loaded, `get` returns `undefined` and `isManaged`
returns `false`. Consumers that run at startup should use `get$`, which re-emits after the SDK
loads and after every profile change.

A client's acquisition code passes the administrator's raw settings, as a JSON string, to
`update_from_json` on the handle from `client$`. TypeScript does not normalize the settings.

## Developing without a real profile

Acquiring a real profile needs an administrator-installed policy on Chrome, a native managed
manifest on Firefox, or a configuration profile, policy registry value, or root-owned file on
desktop, and web and the CLI have no acquisition path at all. To exercise a managed setting without
any of that, set the `managedSettingsDevSource` dev flag to the nested settings object you want the
client to see:

```jsonc
// apps/[browser|desktop|web|cli]/config/local.json
{
  "devFlags": {
    "managedSettingsDevSource": {
      "environment": { "base": "https://localhost:8080" },
    },
  },
}
```

The client then uses `DevManagedSettingsService` instead of `DefaultManagedSettingsService`, which
passes that object to the SDK exactly as a host acquisition would, so `get("environment.base")`
returns the JSON-encoded `"\"https://localhost:8080\""`.

Three things to know:

- **The flag replaces host acquisition, it does not add to it.** With the flag set, the browser
  extension does not read `chrome.storage.managed` and the desktop main process does not read the
  host. Unset the flag to test the real path.
- **Desktop applies the flag in the main process only.** The renderer always receives its profile
  from the main process over `bitwarden-ipc`, so the flag also exercises that replication.
- **Any value enables the flag, including `{}`.** An empty object gives you an empty profile and
  still disables host acquisition.

`config/local.json` is gitignored, which is why the flag belongs there rather than in a committed
`config/development.json` — a committed value would turn the dev source on for everyone. The flag
is also inert outside a development build, because `devFlagEnabled` requires `ENV=development`.
