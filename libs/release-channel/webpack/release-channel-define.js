/**
 * Builds the `DefinePlugin` definitions that carry the release channel into a bundle.
 *
 * `process.env.RELEASE_CHANNEL` is `"beta"` when `channel` is `"beta"`, and `"production"` for any
 * other value, including no value. Desktop and the browser pass `process.env.CHANNEL`. Web and the
 * CLI have no beta channel and call it with no argument.
 *
 * `DefinePlugin` inlines the value, so a shell variable with the same name cannot override it.
 *
 * @param {string | undefined} [channel] The build channel, from `process.env.CHANNEL`
 * @returns {Record<string, string>} Definitions to pass to `webpack.DefinePlugin`
 */
function releaseChannelDefinitions(channel) {
  return {
    "process.env.RELEASE_CHANNEL": JSON.stringify(channel === "beta" ? "beta" : "production"),
  };
}

module.exports = { releaseChannelDefinitions };
