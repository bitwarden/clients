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

// Beta channel manifest overrides live in `manifest-beta-overrides.json` so the diff
// between the stable and beta manifest is visible in one file. Nested
// overrides (e.g. action.default_title) are only merged when the target key
// already exists, which naturally handles the MV2 (`browser_action`) vs MV3
// (`action`) split. Version stamping is handled separately post-build by
// scripts/update-manifest-beta.sh.
function transformChannel(manifest) {
  if (process.env.CHANNEL !== "beta") {
    return manifest;
  }
  return applyOverrides(manifest, require("./manifest-beta-overrides.json"));
}

function applyOverrides(target, overrides) {
  for (const [key, value] of Object.entries(overrides)) {
    if (isPlainObject(value)) {
      if (target[key]) {
        applyOverrides(target[key], value);
      }
    } else {
      target[key] = value;
    }
  }
  return target;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
