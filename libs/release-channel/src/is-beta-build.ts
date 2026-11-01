import { flagEnabled } from "@bitwarden/common/platform/misc/flags";

/**
 * Whether the client was built for the beta channel, read synchronously. `CHANNEL=beta` builds of
 * Desktop and the browser extension set the `prereleaseBuild` flag through `config/beta.json`.
 *
 * Use this for checks that only depend on the build, such as the beta logos and the
 * "Bitwarden Beta" name. Inject `ReleaseChannelService` for the beta status.
 */
export function isBetaBuild(): boolean {
  return flagEnabled("prereleaseBuild");
}
