# managed-settings

Owned by: platform

Administrator-forced client settings acquired from operating system device-management (UEM/MDM) channels

For the concepts, the SDK side, and precedence rules, see the
[SDK `bitwarden-managed-settings` README](https://github.com/bitwarden/sdk-internal/blob/main/crates/bitwarden-managed-settings/README.md).

## Consuming a setting

Inject the abstract `ManagedSettingsService` from `@bitwarden/managed-settings`. Its reads are
synchronous (`get`, `isManaged`) or an observable seeded with the current value (`get$`). Values are
JSON-encoded strings, so decode them and check the type. Guard user writes with `isManaged`:

```ts
import { combineLatest, map, Observable } from "rxjs";

import { ManagedSettingsService } from "@bitwarden/managed-settings";

const PASSWORD_LENGTH = "generator.password.length";

function decodeLength(raw: string | undefined): number | undefined {
  if (raw == null) {
    return undefined;
  }
  const value: unknown = JSON.parse(raw);
  return typeof value === "number" ? value : undefined;
}

export class PasswordLengthService {
  constructor(private readonly managedSettingsService: ManagedSettingsService) {}

  /** The managed length when present, otherwise the user's. */
  length$(userLength$: Observable<number>): Observable<number> {
    return combineLatest([
      this.managedSettingsService.get$(PASSWORD_LENGTH).pipe(map(decodeLength)),
      userLength$,
    ]).pipe(map(([managed, user]) => managed ?? user));
  }

  setLength(length: number): void {
    if (this.managedSettingsService.isManaged(PASSWORD_LENGTH)) {
      throw new Error("Password length is set by your administrator");
    }
    // Persist `length` to user state.
  }
}
```

`isManaged` tests key presence only, so a value of the wrong type still counts as managed. Prefer
`get$` over a one-off `get`, because the first profile can arrive after startup.

No feature consumes `ManagedSettingsService` yet. Angular clients get it from
`jslib-services.module.ts`; the browser background constructs it in `main.background.ts`.

## Adding a new setting key

There is no key registry. A key is a string shared by the consuming feature and the administrator's
configuration.

- **Naming**: `flattenSettings` turns the administrator's nested object into dotted keys, so
  `{ generator: { password: { length: 20 } } }` becomes `generator.password.length`. Lead with the
  feature area and use camelCase segments, like `environment.webVault`. Never put a dot inside a
  segment: `{ "a.b": 1 }` and `{ a: { b: 1 } }` collide.
- **Value shape**: only plain objects are descended into. Every other value is a leaf stored as
  `JSON.stringify(value)`, so `20` is `"20"` and an array is stored whole. `undefined` leaves are
  dropped.
- **Chrome schema**: declare the key in `apps/browser/src/managed_schema.json`. Chrome publishes
  only the policies declared there and withholds values that do not conform to it
  (`BrowserApi.getManagedStorage` notes the same). The Firefox build strips the `storage` manifest
  key, so Firefox uses no schema.

Test the consuming feature with `mockManagedSettingsService()` from `@bitwarden/common/spec`. Cover
the managed, unmanaged, and wrong-type cases:

```ts
import { of } from "rxjs";

import { mockManagedSettingsService } from "@bitwarden/common/spec";

const managedSettingsService = mockManagedSettingsService();
managedSettingsService.get$.mockReturnValue(of("20"));
managedSettingsService.isManaged.mockReturnValue(true);
```

## Host acquisition wiring

The browser extension is the only client that acquires a profile. In `main.background.ts`, unless
the `managedSettingsDevSource` dev flag is set, the background constructs
`DefaultManagedSettingsService(SdkLoadService.Ready)` and a `BrowserManagedConfigReader`, and
`bootstrap()` awaits `BrowserManagedConfigReader.init()` before `sdkLoadService.loadAndInit()`.

`init()` reads once, then re-reads on every `storage.onChanged` event whose area is `"managed"`.
Each read runs:

1. `BrowserApi.getManagedStorage()` reads `chrome.storage.managed`.
2. `createManagementProfile` flattens the object with `flattenSettings` and stamps
   `MANAGEMENT_PROFILE_VERSION` and `updatedAt`.
3. `ManagedSettingsService.updateProfile` stores the profile. `DefaultManagedSettingsService`
   mirrors it into the SDK's `ManagedSettingsClient` once WASM has loaded, and `DefaultSdkService`
   passes that handle, from `client$`, into the SDK clients it creates.

An empty policy clears the profile with `updateProfile(undefined)`. A failed read keeps the last
known profile, because the managed state is unknown rather than absent. A browser with no managed
storage area returns without pushing. Values are never logged; only key names and counts are.

Desktop and mobile need the same pieces: read the OS channel, build the profile with
`createManagementProfile` (or the same flattening and `MANAGEMENT_PROFILE_VERSION` in Swift or
Kotlin), push it, re-read on change, keep the last known profile on a failed read, and skip
acquisition while the dev flag is set. The proposed desktop design reads the value in the Electron
main process and has the SDK replicate the profile to the renderer
([PM-43024](https://bitwarden.atlassian.net/browse/PM-43024)).

## Admin deployment example

These examples set `environment.base`, the only key `managed_schema.json` declares today. The
extension IDs are the store builds: Chrome `nngceckbapebfimnlniiiahkandclblb`, Firefox
`{446900e4-71c2-419f-a6a7-df9c091e268b}` (`browser_specific_settings.gecko.id`). An unpacked Chrome
build gets its own ID; copy it from `chrome://extensions`.

**Chrome** on Linux, as a testing aid: save as `/etc/opt/chrome/policies/managed/bitwarden.json`.

```json
{
  "3rdparty": {
    "extensions": {
      "nngceckbapebfimnlniiiahkandclblb": {
        "environment": { "base": "https://bitwarden.example.com" }
      }
    }
  }
}
```

On Windows, write the same policy under
`HKLM\Software\Policies\Google\Chrome\3rdparty\extensions\<id>\policy` (or `HKCU`). On macOS, use
the `com.google.Chrome.extensions.<id>` preference domain or a `.mobileconfig` profile. See
[Configuring policy for extensions](https://www.chromium.org/administrators/configuring-policy-for-extensions/).

**Firefox** native managed-storage manifest, saved as `<name>.json` in
`/usr/lib/mozilla/managed-storage/` (Linux) or
`/Library/Application Support/Mozilla/ManagedStorage/` (macOS). On Windows, create
`HKLM\SOFTWARE\Mozilla\ManagedStorage\<name>` with the file's path as its default value.

```json
{
  "name": "{446900e4-71c2-419f-a6a7-df9c091e268b}",
  "description": "ignored",
  "type": "storage",
  "data": {
    "environment": { "base": "https://bitwarden.example.com" }
  }
}
```

Or the `3rdparty` enterprise policy in `policies.json` (in the `distribution` directory next to the
Firefox binary, or `/etc/firefox/policies/` on Linux):

```json
{
  "policies": {
    "3rdparty": {
      "Extensions": {
        "{446900e4-71c2-419f-a6a7-df9c091e268b}": {
          "environment": { "base": "https://bitwarden.example.com" }
        }
      }
    }
  }
}
```

Firefox loads managed-storage changes only on restart. Chrome applies them live.

## Testing MDM

To check that a new setting arrives, use the dev flag for fast iteration, then a real policy before
sign-off. Both paths are checked from the background console: `chrome://extensions` → the
extension's service worker or background page → Inspect, or `about:debugging` → This Firefox →
Inspect on Firefox.

### Dev flag (no real profile)

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
Confirm in the background console:

```js
bitwardenMain.managedSettingsService.get("environment.base"); // '"https://localhost:8080"'
```

Two things to know:

- **The flag replaces host acquisition, it does not add to it.** With the flag set, the browser
  extension does not read `chrome.storage.managed` at all, and no `Managed configuration:` log line
  appears. Unset the flag to test the real path.
- **Any value enables the flag, including `{}`.** An empty object gives you an empty profile and
  still disables host acquisition.

`config/local.json` is gitignored, which is why the flag belongs there rather than in a committed
`config/development.json` — a committed value would turn the dev source on for everyone. The flag
is also inert outside a development build, because `devFlagEnabled` requires `ENV=development`.

### Real policy

1. Unset `managedSettingsDevSource`, declare the key in `managed_schema.json`, and build.
2. Deploy a policy as in [Admin deployment example](#admin-deployment-example), using your build's
   extension ID. Restart Firefox.
3. Chrome: open `chrome://policy`, select Reload policies, and check that the extension's policy is
   listed without errors. Firefox: `about:policies` lists a `3rdparty` policy; a native manifest
   does not appear there.
4. In the background console, look for
   `Managed configuration: applied N managed setting(s).` followed by the key names, then read the
   value with `bitwardenMain.managedSettingsService.get("<key>")`.
5. Change or remove the policy. Chrome re-reads without a restart and logs the new count, or
   `Managed configuration: no managed settings are set.` once the policy is empty.

`Managed configuration: unavailable, keeping the last known profile.` means the read failed. On
Firefox this is the normal result when no manifest or policy is installed.

## Current limitations

- Only the browser extension's background acquires a profile, on Chrome and Firefox. Extension pages
  such as the popup get `DefaultManagedSettingsService` from `jslib-services.module.ts` with no
  reader, so they see an empty profile under a real policy. The dev flag seeds every context, so it
  does not reveal this.
- Desktop acquisition is proposed, not shipped
  ([PM-43024](https://bitwarden.atlassian.net/browse/PM-43024), blocked on
  [PM-44588](https://bitwarden.atlassian.net/browse/PM-44588)).
- The web vault and CLI have no acquisition path. The Safari extension has none either: Safari has
  no `storage.managed`, and the reader logs that the browser has no managed storage area.
- The SDK's mobile bindings exist, but no mobile client feeds them. iOS passes an inert
  `ManagedSettingsBindingClient()` and reads MDM configuration through its own
  `com.apple.configuration.managed` path
  ([bitwarden/ios#2989](https://github.com/bitwarden/ios/pull/2989)).
- The first profile push is asynchronous, so reads made before it see no profile.
- Managed settings never apply on their own. Each feature opts in by reading its keys.
- Conflicts between a policy and a managed setting are the consuming feature's to resolve.
- `environment.*` is not read through this service. `BrowserEnvironmentService` reads
  `chrome.storage.managed` directly; moving it is
  [bitwarden/clients#22908](https://github.com/bitwarden/clients/pull/22908), still open.
