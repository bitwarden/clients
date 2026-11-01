# release-channel

Owned by: platform

This library is responsible for surfacing to consumers the current client's relationship with our release channels. It answers these questions:

| **Question**                                    | **Kind of fact**                         | **API**              |
| ----------------------------------------------- | ---------------------------------------- | -------------------- |
| Is this client on the beta release channel?     | A client property, fixed at build time   | `isBetaChannel()`    |
| What is the status of Bitwarden's beta channel? | An environment property, from the server | `betaChannelStatus$` |
| May this client be used?                        | Both combined                            | `betaClientAccess$`  |

## The client: `isBetaChannel()`

`isBetaChannel()` returns whether the client is on the beta release channel, synchronously. A client is on the beta channel when its build sets the existing `prereleaseBuild` flag, which `CHANNEL=beta` builds of Desktop and the browser extension get from their `config/beta.json`. Web and the CLI are never on the beta channel.

Use it for checks that only depend on the client, such as the beta logos and the "Bitwarden Beta" name.

## The environment: `betaChannelStatus$`

`ReleaseChannelService.betaChannelStatus$` emits the status of the beta channel in the connected environment. It comes from the permanent `beta-channel-status` feature flag, which the client receives in the server config through `ConfigService`. It is read the same way on every client, beta or not.

| **Status** | **Flag value** | **Meaning**                                     |
| ---------- | -------------- | ----------------------------------------------- |
| `Open`     | `"open"`       | Beta clients work normally.                     |
| `Closing`  | `"closing"`    | The beta channel is closing. Beta clients warn. |
| `Closed`   | `"closed"`     | The beta channel is closed. Beta clients block. |

- The flag fails open. Only an explicit `"closing"` or `"closed"` changes the channel.
- Anything else reports `Open`: `"open"`, an unknown or differently cased value, an empty string, a non-string value, and a missing key, which resolves to the client default `"open"`.
- The status can move in any direction. Serving `"open"` again reopens the channel.
- The status carries no date. Product ends the beta by explicitly serving `"closed"`, after `"closing"` when it wants a warning period.

`betaChannelStatus$` follows the server config. Before the first config loads, it reports the default, `Open`. A beta against a closed channel can briefly report `Open` on a first launch, until the config arrives. After that, a slow or failed fetch keeps the last config. It emits only when the status changes.

The flag is in the **Permanent** section of `FeatureFlag` in `libs/common/src/enums/feature-flag.enum.ts` and of `FeatureFlagKeys` in the server's `src/Core/Constants.cs`. Permanent flags are operational, are never removed, and are exempt from the flag cleanup lifecycle.

### Set the flag in LaunchDarkly

The server adds the `client-version-is-prerelease` attribute to the LaunchDarkly device and user contexts, from the `Is-Prerelease: 1` header that only beta clients send. The context also carries `client-version` and `device-type`. So one targeting rule reaches every beta client, signed in or not.

To open the beta channel, then close it:

1. In LaunchDarkly, open `beta-channel-status`.
2. Add a rule: `client-version-is-prerelease` is `true`. Serve `"open"`.
3. When Product decides to close the channel, change the served value to `"closing"`.
4. When the channel closes, change the served value to `"closed"`.

Set the flag's off variation to `"open"`, so turning the flag off does not block anyone. End the beta by serving `"closed"`.

To limit a rule to one client or version range, add a `device-type` or `client-version` clause to the rule. Production clients are always allowed, whatever the flag serves.

An environment without the flag, such as a QA server with no rule, leaves the beta channel open.

### Self-hosted and offline

A self-hosted server does not contact LaunchDarkly, so it sends no value for `beta-channel-status` unless the operator sets one in `Features:FlagValues`. With no value, the flag fails open, and beta clients can connect to self-hosted servers.

Offline, the client keeps the cached config, so the last status it received stays in place until the next successful fetch.

## The combination: `betaClientAccess$`

`ReleaseChannelService.betaClientAccess$` emits whether this client may be used. **Warning and block surfaces, such as those in PM-46097, read this.**

| **Client**                     | **Access**                                          |
| ------------------------------ | --------------------------------------------------- |
| Not on the beta channel        | Always `Allowed`, at once. It never reads the flag. |
| On the beta channel, `Open`    | `Allowed`                                           |
| On the beta channel, `Closing` | `Warning`                                           |
| On the beta channel, `Closed`  | `Blocked`                                           |

For a beta client, `betaClientAccess$` follows `betaChannelStatus$`, so it also reports `Allowed` before the first server config.

```ts
const access = await firstValueFrom(releaseChannelService.betaClientAccess$);
if (access === BetaClientAccess.Blocked) {
  // Show the block screen.
}
```

## Exceptions to preferred usage

`ApiService` in `libs/common` deliberately keeps its own `flagEnabled` check of `prereleaseBuild` for the `Is-Prerelease` header. This library depends on `libs/common`, so `libs/common` cannot import it.

The Desktop main process does not create the service, because it has no `ConfigService`. It only reads `isBetaChannel()`.

These beta logos still read `flagEnabled("prereleaseBuild")` directly, pending their move to `isBetaChannel()` in a separate change owned by UI Foundation:

- `apps/browser/src/platform/popup/layout/popup-header.component.ts`
- `apps/browser/src/popup/components/extension-anon-layout-wrapper/extension-anon-layout-wrapper.component.ts`
- `libs/components/src/landing-layout/landing-header.component.ts`
- `libs/components/src/navigation/nav-logo.component.ts`

Outside of these exceptions, the package API surface should be used as described.

## Test in a real build

There are two ways to change the flag for a test build:

- **Client override.** Every Angular client attaches `bitwardenAutomationDriver` to the window. Its `featureFlags` capability writes a local flag override that wins over the server config. This needs no server changes.
- **Server override.** A local server with no LaunchDarkly key serves values from `Features:FlagValues`. This tests the real delivery path through the server config.

A server that sends no value, such as a self-hosted or local dev server without an override, reports `open` and `allowed`, the same as a cloud config without the key. The warning and block screens come in PM-46097. Until they exist, you see the values in a developer tools console.

Each test sets these flag values in order. The expected access for a beta client is:

| **Flag value** | `"open"`  | `"closing"` | `"Open"`  | `"bogus"` | `"closed"` | `"open"`  |
| -------------- | --------- | ----------- | --------- | --------- | ---------- | --------- |
| **Access**     | `allowed` | `warning`   | `allowed` | `allowed` | `blocked`  | `allowed` |

`betaClientAccess$` emits only when the access changes, so `"Open"` emits `allowed`, and `"bogus"` emits nothing new.

### Test the Desktop app

The release build of Desktop has no developer tools. Build Desktop in development mode with the beta channel. The service code and the channel are the same in both modes.

1. Go to `apps/desktop`.
2. If you have not built the native module before, run `npm run build-native`.
3. Run `npx cross-env CHANNEL=beta npm run build:dev`.
4. Run `npm run start`. The Desktop app opens.
5. Press F12 to open the developer tools.
6. In the **Console** tab, run this code to set `"open"`:

   ```js
   const flags = bitwardenAutomationDriver.get("featureFlags");
   await flags.set("beta-channel-status", "open");
   ```

7. Paste this code and press Enter:

   ```js
   let req;
   self.webpackChunk_bitwarden_desktop.push([[Symbol()], {}, (r) => (req = r)]);
   const { ReleaseChannelService } = req("../../libs/release-channel/src/index.ts");
   const releaseChannel = ng
     .getInjector(document.querySelector("app-root"))
     .get(ReleaseChannelService);
   releaseChannel.betaClientAccess$.subscribe((access) =>
     console.log(new Date().toISOString(), "access", access),
   );
   releaseChannel.betaChannelStatus$.subscribe((status) =>
     console.log(new Date().toISOString(), "status", status),
   );
   ```

   The code gets the app's own `ReleaseChannelService` from Angular. `ng` exists only in development builds.

8. Make sure that the console shows `access allowed` and `status open`.
9. Run `await flags.set("beta-channel-status", "closing")`, and make sure that the console shows `access warning`.
10. Run `await flags.set("beta-channel-status", "Open")`, and make sure that the console shows `access allowed`.
11. Run `await flags.set("beta-channel-status", "bogus")`. Make sure that no new access value appears.
12. Run `await flags.set("beta-channel-status", "closed")`, and make sure that the console shows `access blocked`.
13. Run `await flags.set("beta-channel-status", "open")`, and make sure that the console shows `access allowed`.

### Test the browser extension

1. Go to `apps/browser`.
2. Run `npm run build:beta:chrome`. The build writes the extension to `apps/browser/build`.
3. In Chrome, go to `chrome://extensions`.
4. Turn on **Developer mode**.
5. Select **Load unpacked**.
6. Select the `apps/browser/build` folder.
7. Open the extension popup. Right-click in it and select **Inspect**. The developer tools open for the popup.
8. In the popup **Console** tab, run this code to set `"open"`:

   ```js
   const flags = bitwardenAutomationDriver.get("featureFlags");
   await flags.set("beta-channel-status", "open");
   ```

9. On the Bitwarden card in `chrome://extensions`, select the **service worker** link. The developer tools open for the background service worker.
10. In the service worker **Console** tab, paste this code and press Enter:

    ```js
    bitwardenMain.releaseChannelService.betaClientAccess$.subscribe((access) =>
      console.log(new Date().toISOString(), "access", access),
    );
    ```

11. Make sure that the console shows `access allowed`. The override is stored on disk, so the background sees it.
12. Keep the service worker developer tools open, so that Chrome does not stop the worker and end the subscription.
13. In the popup console, run `await flags.set("beta-channel-status", "closing")`. In the service worker console, make sure that `access warning` appears.
14. In the popup console, run `await flags.set("beta-channel-status", "Open")`. Make sure that `access allowed` appears.
15. In the popup console, run `await flags.set("beta-channel-status", "bogus")`. Make sure that no new access value appears.
16. In the popup console, run `await flags.set("beta-channel-status", "closed")`. Make sure that `access blocked` appears.
17. In the popup console, run `await flags.set("beta-channel-status", "open")`. Make sure that `access allowed` appears.

### Test the server delivery path

Use this to confirm that the server sends the flag. It needs a local server set up as described in the [server setup guide](https://contributing.bitwarden.com/getting-started/server/guide).

1. In the server repository, run `dotnet user-secrets set "Features:FlagValues:beta-channel-status" "open" --project src/Api`.
2. Start or restart the API with `dotnet run --project src/Api`. The server reads flag values only at startup.
3. Run `curl -s http://localhost:4000/config` and make sure that `featureStates` contains `"beta-channel-status": "open"`.
4. Point the Desktop dev build or the extension at your local server, and sign in.
5. Subscribe as in step 7 of the Desktop test, or steps 9 and 10 of the extension test. Skip the client override, and make sure that the console shows `access allowed`.
6. To change the status, set a new value with `dotnet user-secrets set`, restart the API, and select **Sync now**. In Desktop, it is in the **File** menu. In the extension, it is in **Settings** > **Vault options**. The client fetches the config again after a sync.

### Reset

1. In the Desktop console or the popup console, run `await bitwardenAutomationDriver.get("featureFlags").clearAll()`.
2. In the server repository, run `dotnet user-secrets remove "Features:FlagValues:beta-channel-status" --project src/Api`.
3. Restart the API.

## Run the unit tests

1. Open a terminal in the repository root.
2. Run `npm test -- libs/release-channel`.
