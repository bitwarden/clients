/**
 * Transform the manifest template into a browser specific manifest.
 *
 * We support a simple browser prefix to the manifest keys. Example:
 *
 * ```json
 * {
 *   "name": "Default name",
 *   "__chrome__name": "Chrome override"
 * }
 * ```
 *
 * Will result in the following manifest:
 *
 * ```json
 * {
 *  "name": "Chrome override"
 * }
 * ```
 *
 * for Chrome.
 */
function transform(browser) {
  return (buffer) => {
    let manifest = JSON.parse(buffer.toString());

    manifest = transformPrefixes(manifest, browser);
    manifest = transformChannel(manifest);

    return JSON.stringify(manifest, null, 2);
  };
}

// Beta builds route the extension name through a channel-specific i18n message
// key so translators can localize the beta variant alongside the stable one.
function transformChannel(manifest) {
  if (process.env.CHANNEL === "beta") {
    manifest.name = "__MSG_extNameBeta__";
  }
  return manifest;
}

const browsers = ["chrome", "edge", "firefox", "opera", "safari"];

/**
 * Flatten the browser prefixes in the manifest.
 *
 * - Removes unrelated browser prefixes.
 * - A null value deletes the non prefixed key.
 */
function transformPrefixes(manifest, browser) {
  const prefix = `__${browser}__`;

  function transformObject(obj) {
    return Object.keys(obj).reduce((acc, key) => {
      // Determine if we need to recurse into the object.
      const nested = typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key]);

      if (key.startsWith(prefix)) {
        const newKey = key.slice(prefix.length);

        // Null values are used to remove keys.
        if (obj[key] == null) {
          delete acc[newKey];
          return acc;
        }

        acc[newKey] = nested ? transformObject(obj[key]) : obj[key];
      } else if (!browsers.some((b) => key.startsWith(`__${b}__`))) {
        acc[key] = nested ? transformObject(obj[key]) : obj[key];
      }

      return acc;
    }, {});
  }

  return transformObject(manifest);
}

module.exports = {
  transform,
};
