/** The release channel a client was built for. Fixed at build time. */
export const ReleaseChannelType = Object.freeze({
  Production: "production",
  Beta: "beta",
} as const);
export type ReleaseChannelType = (typeof ReleaseChannelType)[keyof typeof ReleaseChannelType];

/**
 * The channel the client was built for, read synchronously.
 *
 * Use this for checks that depend only on the channel, such as the beta logos, the
 * "Bitwarden Beta" name, and the `Is-Prerelease` header. For the beta sunset status, inject
 * `ReleaseChannelService` from `@bitwarden/release-channel`.
 *
 * Webpack inlines `process.env.RELEASE_CHANNEL` at build time. `CHANNEL=beta` Desktop and browser
 * builds get `"beta"`. Every other build, including web, the CLI, Storybook, and Jest, gets
 * `"production"` or leaves it unset, which also means production.
 */
export function getReleaseChannelType(): ReleaseChannelType {
  return process.env.RELEASE_CHANNEL === ReleaseChannelType.Beta
    ? ReleaseChannelType.Beta
    : ReleaseChannelType.Production;
}
