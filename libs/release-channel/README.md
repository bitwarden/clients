# release-channel

Owned by: platform

`ReleaseChannelService` tells the client which release channel it was built for. For a beta build, it also tells them where that beta is in its sunset. The warning and block surfaces read the service. They do not read feature flags or build config themselves.

## What the service does

A build is either a production build or a beta build. The channel is fixed at build time. A build is a beta build when it sets the existing `prereleaseBuild` flag, which `CHANNEL=beta` builds of Desktop and the browser extension get from their `config/beta.json`. For a beta build, the sunset status comes from one permanent LaunchDarkly flag, which the client receives in the server config through `ConfigService`. Product changes the status in LaunchDarkly, with no client release.

| **Member** | **Type**                     | **Meaning**                                                                                                                                                                                   |
| ---------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channel$` | `Observable<ReleaseChannel>` | The channel. A production build emits a `ProductionChannel` and never reads the flag. A beta build emits once a server config exists, and again each time the server config changes the flag. |

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

`ReleaseChannelType`, `BetaStatus`, and the channel shapes are exported from this library. Code that only needs to know whether the build is a beta, such as the beta logos, the "Bitwarden Beta" name, and the `Is-Prerelease` header, keeps reading `flagEnabled("prereleaseBuild")`.

## The flag

The flag is in the **Permanent** section of `FeatureFlag` in `libs/common/src/enums/feature-flag.enum.ts` and of `FeatureFlagKeys` in the server's `src/Core/Constants.cs`. Permanent flags are operational, are never removed, and are exempt from the flag cleanup lifecycle.

| **Flag key**          | **Type** | **Values**                              | **Client default** |
| --------------------- | -------- | --------------------------------------- | ------------------ |
| `beta-channel-status` | string   | `"active"`, `"warning"`, or `"blocked"` | `"blocked"`        |

**Beta clients are cloud-only.** The client default is `"blocked"`, so a beta works only while LaunchDarkly serves `"active"` or `"warning"`. A server config without the key, including one from a server whose flag was deleted, blocks the beta.

The service maps the flag like this:

- Only the exact values `"active"` and `"warning"` keep a beta running. They map to `Active` and `Warning`.
- Anything else blocks: `"blocked"`, an unknown or differently cased value, an empty string, a non-string value, and a missing key, which resolves to the client default.
- The status can move in any direction. Setting the flag back to `"active"` unblocks a beta.

`channel$` waits for a server config. On a first launch, the client has no config until the first fetch completes, and `channel$` emits nothing until then, so a cloud beta does not flash `Blocked`. After that, a slow or failed fetch keeps the last config.

The status carries no date, so the warning copy does not state one. Product moves the flag from `"warning"` to `"blocked"` when it chooses.

## Set the flag in LaunchDarkly

The server adds the `client-version-is-prerelease` attribute to the LaunchDarkly device and user contexts, from the `Is-Prerelease: 1` header that only beta builds send. The context also carries `client-version` and `device-type`. So one targeting rule reaches every beta client, signed in or not, and no production client.

To run a beta, then warn, then block it:

1. In LaunchDarkly, open `beta-channel-status`.
2. Add a rule: `client-version-is-prerelease` is `true`. Serve `"active"`. Betas block until this rule serves `"active"`.
3. When Product decides to warn, change the served value to `"warning"`.
4. When Product decides to block the beta, change the served value to `"blocked"`.

Set the flag's off variation to `"blocked"`, so turning the flag off acts as a kill switch.

To limit a rule to one client or version range, add a `device-type` or `client-version` clause to the rule. Production clients ignore the flag, so the default rule does not affect them.

**Every environment that runs beta builds needs the flag configured**, including QA and local servers. Without it, betas block.

## Self-hosted and offline behavior

A self-hosted server does not contact LaunchDarkly, so its config response has no `beta-channel-status` entry. **A beta client is blocked against a self-hosted server.** A self-hosted operator could set `Features:FlagValues:beta-channel-status` to `"active"`, but that is unsupported.

The status follows the server config the client last fetched. Offline, the client keeps the cached config, so the last status it received stays in place until the next successful fetch.

## Touch points outside the package

The change lives in this library. Only these files outside it change:

| **File**                                                                          | **Change**                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `libs/common/src/enums/feature-flag.enum.ts`                                      | The `beta-channel-status` entry and default, in **Permanent**      |
| `apps/desktop/src/app/services/services.module.ts`                                | Registers the service for the Desktop renderer                     |
| `apps/browser/src/popup/services/services.module.ts`                              | Registers the service for the extension popup                      |
| `apps/browser/src/background/main.background.ts`                                  | Creates the service for the extension background                   |
| `tsconfig.base.json`, `jest.config.js`, `.github/CODEOWNERS`, `package-lock.json` | Nx library scaffolding: path alias, Jest project, owner, workspace |

The Desktop main process does not create the service, because it has no `ConfigService`.

## Test the sunset in a real build

There are two ways to change the flag for a test build:

- **Client override.** Every Angular client attaches `bitwardenAutomationDriver` to the window. Its `featureFlags` capability writes a local flag override that wins over the server config. This needs no server changes.
- **Server override.** A local server with no LaunchDarkly key serves values from `Features:FlagValues`. This tests the real delivery path through the server config.

A server without LaunchDarkly, such as a local dev server, blocks beta builds. So each test sets `"active"` first, with the client override or the server override. The warning and block screens come in PM-46097. Until they exist, you see the status in a developer tools console.

### Test the Desktop app

The release build of Desktop has no developer tools. Build Desktop in development mode with the beta channel. The service code and the channel are the same in both modes.

1. Go to `apps/desktop`.
2. If you have not built the native module before, run `npm run build-native`.
3. Run `npx cross-env CHANNEL=beta npm run build:dev`.
4. Run `npm run start`. The Desktop app opens.
5. Press F12 to open the developer tools.
6. In the **Console** tab, run this code to set `"active"`:

   ```js
   const flags = bitwardenAutomationDriver.get("featureFlags");
   await flags.set("beta-channel-status", "active");
   ```

7. Paste this code and press Enter:

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

8. Make sure that the console shows a channel with `type: "beta"` and `status: "active"`.
9. Run `await flags.set("beta-channel-status", "warning")`.
10. Make sure that the console shows a channel with `status: "warning"`.
11. Run `await flags.set("beta-channel-status", "blocked")`.
12. Make sure that the console shows a channel with `status: "blocked"`.

### Test the browser extension

1. Go to `apps/browser`.
2. Run `npm run build:beta:chrome`. The build writes the extension to `apps/browser/build`.
3. In Chrome, go to `chrome://extensions`.
4. Turn on **Developer mode**.
5. Select **Load unpacked**.
6. Select the `apps/browser/build` folder.
7. Open the extension popup. Right-click in it and select **Inspect**. The developer tools open for the popup.
8. In the popup **Console** tab, run this code to set `"active"`:

   ```js
   const flags = bitwardenAutomationDriver.get("featureFlags");
   await flags.set("beta-channel-status", "active");
   ```

9. On the Bitwarden card in `chrome://extensions`, select the **service worker** link. The developer tools open for the background service worker.
10. In the service worker **Console** tab, paste this code and press Enter:

    ```js
    bitwardenMain.releaseChannelService.channel$.subscribe((channel) =>
      console.log(new Date().toISOString(), channel),
    );
    ```

11. Make sure that the console shows a channel with `type: "beta"` and `status: "active"`. The override is stored on disk, so the background sees it.
12. Keep the service worker developer tools open, so that Chrome does not stop the worker and end the subscription.
13. In the popup console, run `await flags.set("beta-channel-status", "warning")`.
14. In the service worker console, make sure that a channel with `status: "warning"` appears.
15. In the popup console, run `await flags.set("beta-channel-status", "blocked")`.
16. In the service worker console, make sure that a channel with `status: "blocked"` appears.

### Test the server delivery path

Use this to confirm that the server sends the flag. It needs a local server set up as described in the [server setup guide](https://contributing.bitwarden.com/getting-started/server/guide).

1. In the server repository, run `dotnet user-secrets set "Features:FlagValues:beta-channel-status" "active" --project src/Api`.
2. Start or restart the API with `dotnet run --project src/Api`. The server reads flag values only at startup.
3. Run `curl -s http://localhost:4000/config` and make sure that `featureStates` contains `"beta-channel-status": "active"`.
4. Point the Desktop dev build or the extension at your local server, and sign in.
5. Subscribe as in step 7 of the Desktop test, or steps 9 and 10 of the extension test. Skip the client override, and make sure that the channel shows `status: "active"`.
6. To change the status, set a new value with `dotnet user-secrets set`, restart the API, and select **Sync now**. In Desktop, it is in the **File** menu. In the extension, it is in **Settings** > **Vault options**. The client fetches the config again after a sync.

### Reset

1. In the Desktop console or the popup console, run `await bitwardenAutomationDriver.get("featureFlags").clearAll()`.
2. In the server repository, run `dotnet user-secrets remove "Features:FlagValues:beta-channel-status" --project src/Api`.
3. Restart the API.

## Run the unit tests

1. Open a terminal in the repository root.
2. Run `npm test -- libs/release-channel`.
