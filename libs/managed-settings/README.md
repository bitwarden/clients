# managed-settings

Owned by: platform

Administrator-forced client settings acquired from operating system device-management (UEM/MDM) channels

## Developing without a real profile

Acquiring a real profile needs an administrator-installed policy on Chrome or a native managed
manifest on Firefox, and web, desktop, and the CLI have no acquisition path at all. To exercise a
managed setting without any of that, set the `managedSettingsDevSource` dev flag to the nested
settings object you want the client to see:

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

The DI container then provides `DevManagedSettingsService` instead of
`DefaultManagedSettingsService`, seeded from that object. It is flattened exactly as a host profile
would be, so `get("environment.base")` returns the JSON-encoded `"\"https://localhost:8080\""`.

Two things to know:

- **The flag replaces host acquisition, it does not add to it.** With the flag set, the browser
  extension does not read `chrome.storage.managed` at all. Unset the flag to test the real path.
- **Any value enables the flag, including `{}`.** An empty object gives you an empty profile and
  still disables host acquisition.

`config/local.json` is gitignored, which is why the flag belongs there rather than in a committed
`config/development.json` — a committed value would turn the dev source on for everyone. The flag
is also inert outside a development build, because `devFlagEnabled` requires `ENV=development`.
