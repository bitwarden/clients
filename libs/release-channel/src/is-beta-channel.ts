import { flagEnabled } from "@bitwarden/common/platform/misc/flags";

/**
 * Whether the client is on the beta release channel, read synchronously. This is a property of
 * the client, fixed at build time: `CHANNEL=beta` builds of Desktop and the browser extension set
 * the `prereleaseBuild` flag through `config/beta.json`.
 *
 * Use this for checks that only depend on the client, such as the beta logos and the
 * "Bitwarden Beta" name. Use `ReleaseChannelService.betaClientAccess$` to decide whether a beta
 * client may be used.
 */
export function isBetaChannel(): boolean {
  return flagEnabled("prereleaseBuild");
}
