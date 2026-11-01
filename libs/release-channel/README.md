# release-channel

Owned by: platform

`ReleaseChannelService` tells the client which release channel it was built for. For a beta build, it also tells them where that beta is in its sunset. The warning and block surfaces read the service. They do not read feature flags or build config themselves.

## What the service does

A build is either a production build or a beta build. The channel is fixed at build time. For a beta build, the sunset status comes from one permanent LaunchDarkly flag, which the client receives in the server config through `ConfigService`. Product changes the status in LaunchDarkly, with no client release.

| **Member** | **Type**                     | **Meaning**                                                                                                                                                  |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `channel$` | `Observable<ReleaseChannel>` | The channel. A production build emits a `ProductionChannel` and never reads the flag. A beta build emits again each time the server config changes the flag. |

`ReleaseChannel` is a union of two shapes. Narrow on `type` before you read the beta status:

| **Shape**           | **`type`**     | **Other fields**                        |
| ------------------- | -------------- | --------------------------------------- |
| `ProductionChannel` | `"production"` | None. A production build has no status. |
| `BetaChannel`       | `"beta"`       | `status: BetaStatus`                    |

```ts
const channel = await firstValueFrom(releaseChannelService.channel$);
if (channel.type === ReleaseChannelType.Beta && channel.status === BetaStatus.Blocked) {
  // Show the block screen.
}
```

`ReleaseChannelType` and `getReleaseChannelType()` live in `@bitwarden/common/platform/misc/release-channel-type`, because `libs/common` reads them and cannot depend on this library. Use `getReleaseChannelType()` for checks that depend only on the channel type, such as the beta logos, the "Bitwarden Beta" name, and the `Is-Prerelease` header. Inject `ReleaseChannelService` when you need the beta status.

## The flag

The flag is in the **Permanent** section of `FeatureFlag` in `libs/common/src/enums/feature-flag.enum.ts` and of `FeatureFlagKeys` in the server's `src/Core/Constants.cs`. Permanent flags are operational, are never removed, and are exempt from the flag cleanup lifecycle.

| **Flag key**          | **Type** | **Values**                              | **Client default** |
| --------------------- | -------- | --------------------------------------- | ------------------ |
| `beta-channel-status` | string   | `"active"`, `"warning"`, or `"blocked"` | `"active"`         |

The service maps the flag like this:

- `"warning"` and `"blocked"` map to `Warning` and `Blocked`. Any other value, including an unknown or differently cased one, maps to `Active`.
- The status can move in any direction. Setting the flag back to `"active"` unblocks a beta.

The status carries no date, so the warning copy does not state one. Product moves the flag from `"warning"` to `"blocked"` when it chooses.

## Set the flag in LaunchDarkly

The server adds the `client-version-is-prerelease` attribute to the LaunchDarkly device and user contexts, from the `Is-Prerelease: 1` header that only beta builds send. The context also carries `client-version` and `device-type`. So one targeting rule reaches every beta client, signed in or not, and no production client.

To warn and then block the beta:

1. In LaunchDarkly, open `beta-channel-status`.
2. Add a rule: `client-version-is-prerelease` is `true`. Serve `"warning"`.
3. When Product decides to block the beta, change the served value to `"blocked"`.

To limit a rule to one client or version range, add a `device-type` or `client-version` clause to the rule. Leave the default rule serving `"active"`, so production clients and anything the rule doesn't match keep the client default.

## Self-hosted and offline behavior

A self-hosted server does not contact LaunchDarkly. Its config response includes the flag only when the operator sets a local value under `Features:FlagValues` or `globalSettings:launchDarkly:flagValues`. Without one, the config has no `beta-channel-status` entry, and the client uses its default, `Active`. **A beta client signed in to a self-hosted server never warns or blocks** unless the operator sets the flag.

The status follows the server config the client last fetched. Offline, the client keeps the cached config, so the last status it received stays in place until the next successful fetch.

## Where the channel comes from

Every build defines `process.env.RELEASE_CHANNEL` with `DefinePlugin`, through [`webpack/release-channel-define.js`](webpack/release-channel-define.js), so a shell variable with the same name cannot change it in a built client:

| **Build**                                                | **Value**                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| Desktop main, renderer, and preload                      | `"beta"` for `CHANNEL=beta`, otherwise `"production"`            |
| Every browser bundle, including the background and popup | `"beta"` for `CHANNEL=beta`, otherwise `"production"`            |
| Web and the CLI                                          | Always `"production"`. These clients have no beta channel.       |
| Storybook                                                | Always `"production"`, through the Storybook `env` setting       |
| Jest                                                     | Not defined, which `getReleaseChannelType()` reads as production |

The release channel replaces the old build flag for beta builds, which no longer exists. The callers that read that flag now call `getReleaseChannelType()`:

- the beta logos in the browser popup header, the extension anonymous layout, the Desktop passkey modal header, the landing header, and the side-nav logo
- the "Bitwarden Beta" tray and About dialog name in the Desktop main process
- the browser welcome page, which a beta install still skips
- the `Is-Prerelease: 1` request header in `ApiService`, which the server reads. It is still sent exactly by `CHANNEL=beta` Desktop and browser builds.

The Desktop and browser `config/beta.json` files only set that flag, so they are gone. A `CHANNEL=beta` build still loads the channel config, and a missing file loads as empty.

## Test the sunset in a real build

There are two ways to change the flag for a test build:

- **Client override.** Every Angular client attaches `bitwardenAutomationDriver` to the window. Its `featureFlags` capability writes a local flag override that wins over the server config. This needs no server changes.
- **Server override.** A local server with no LaunchDarkly key serves values from `Features:FlagValues`. This tests the real delivery path through the server config.

The warning and block screens come in PM-46097. Until they exist, you see the status in a developer tools console.

### Test the Desktop app

The release build of Desktop has no developer tools. Build Desktop in development mode with the beta channel. The service code and the channel are the same in both modes.

1. Go to `apps/desktop`.
2. If you have not built the native module before, run `npm run build-native`.
3. Run `npx cross-env CHANNEL=beta npm run build:dev`.
4. Run `npm run start`. The Desktop app opens.
5. Press F12 to open the developer tools.
6. In the **Console** tab, paste this code and press Enter:

   ```js
   let req;
   self.webpackChunk_bitwarden_desktop.push([[Symbol()], {}, (r) => (req = r)]);
   const { ReleaseChannelService } = req("../../libs/release-channel/src/index.ts");
   const releaseChannel = ng
     .getInjector(document.querySelector("app-root"))
     .get(ReleaseChannelService);
   releaseChannel.channel$.subscribe((channel) => console.log(new Date().toISOString(), channel));
   ```

   The code gets the app's own `ReleaseChannelService` from Angular. `ng` exists only in development builds.

7. Make sure that the console shows a channel with `type: "beta"` and `status: "active"`.
8. Run this code:

   ```js
   const flags = bitwardenAutomationDriver.get("featureFlags");
   await flags.set("beta-channel-status", "warning");
   ```

9. Make sure that the console shows a channel with `status: "warning"`.
10. Run `await flags.set("beta-channel-status", "blocked")`.
11. Make sure that the console shows a channel with `status: "blocked"`.

### Test the browser extension

1. Go to `apps/browser`.
2. Run `npm run build:beta:chrome`. The build writes the extension to `apps/browser/build`.
3. In Chrome, go to `chrome://extensions`.
4. Turn on **Developer mode**.
5. Select **Load unpacked**.
6. Select the `apps/browser/build` folder.
7. On the Bitwarden card, select the **service worker** link. The developer tools open for the background service worker.
8. In the **Console** tab, paste this code and press Enter:

   ```js
   bitwardenMain.releaseChannelService.channel$.subscribe((channel) =>
     console.log(new Date().toISOString(), channel),
   );
   ```

9. Make sure that the console shows a channel with `type: "beta"` and `status: "active"`.
10. Keep the service worker developer tools open, so that Chrome does not stop the worker and end the subscription.
11. Open the extension popup. Right-click in it and select **Inspect**. The developer tools open for the popup.
12. In the popup **Console** tab, run this code:

    ```js
    const flags = bitwardenAutomationDriver.get("featureFlags");
    await flags.set("beta-channel-status", "warning");
    ```

13. In the service worker console, make sure that a channel with `status: "warning"` appears. The override is stored on disk, so the background sees it.
14. In the popup console, run `await flags.set("beta-channel-status", "blocked")`.
15. In the service worker console, make sure that a channel with `status: "blocked"` appears.

### Test the server delivery path

Use this to confirm that the server sends the flag. It needs a local server set up as described in the [server setup guide](https://contributing.bitwarden.com/getting-started/server/guide).

1. In the server repository, run `dotnet user-secrets set "Features:FlagValues:beta-channel-status" "warning" --project src/Api`.
2. Start or restart the API with `dotnet run --project src/Api`. The server reads flag values only at startup.
3. Run `curl -s http://localhost:4000/config` and make sure that `featureStates` contains `"beta-channel-status": "warning"`.
4. Point the Desktop dev build or the extension at your local server, and sign in.
5. Do steps 5 to 7 of the Desktop test, or steps 7 to 9 of the extension test, and make sure that the channel shows `status: "warning"`.
6. To change the status, set a new value with `dotnet user-secrets set`, restart the API, and select **Sync now**. In Desktop, it is in the **File** menu. In the extension, it is in **Settings** > **Vault options**. The client fetches the config again after a sync.

### Reset

1. In the Desktop console or the popup console, run `await bitwardenAutomationDriver.get("featureFlags").clearAll()`.
2. In the server repository, run `dotnet user-secrets remove "Features:FlagValues:beta-channel-status" --project src/Api`.
3. Restart the API.

## Run the unit tests

1. Open a terminal in the repository root.
2. Run `npm test -- libs/release-channel`.
