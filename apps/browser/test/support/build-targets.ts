// A build target is the name of an Nx build configuration in `apps/browser/project.json`
// (e.g. `chrome-dev`, `edge-dev`, `firefox-mv2-dev`, `commercial-chrome`). Every configuration
// emits to `dist/apps/browser/<configuration-name>`, so the output dir needs no suffix arithmetic.
// The browser to launch and the extension URL scheme are derived from the browser token embedded
// in the configuration name.

interface BrowserMeta {
  /** WebDriver `browserName` capability value. */
  browserName: string;
  /** Vendor capability key that carries CLI args for this browser. */
  optionsKey: string;
  /** URL scheme extension pages are served from. */
  scheme: string;
}

export const SUPPORTED_BROWSERS: Record<string, BrowserMeta> = {
  chrome: { browserName: "chrome", optionsKey: "goog:chromeOptions", scheme: "chrome-extension" },
  edge: { browserName: "MicrosoftEdge", optionsKey: "ms:edgeOptions", scheme: "chrome-extension" },
  firefox: { browserName: "firefox", optionsKey: "moz:firefoxOptions", scheme: "moz-extension" },
};

// The gecko addon id baked into the firefox build's manifest
// (`browser_specific_settings.gecko.id`). `webExtension.install` returns this id, but Firefox does
// NOT serve extension pages from `moz-extension://<addon-id>/` — it uses a per-profile internal
// UUID. We pin that UUID below via the `extensions.webextensions.uuids` pref so the popup origin is
// deterministic and navigable.
export const FIREFOX_ADDON_ID = "{446900e4-71c2-419f-a6a7-df9c091e268b}";

// The UUID assigned to the addon via `extensions.webextensions.uuids`, used as the
// `moz-extension://<UUID>` popup origin. Any valid UUID works as long as the pref (wdio.conf.ts) and
// the popup URL (install-extension.ts) agree; we reuse the addon id's hex (braces stripped) so both
// derive from a single literal and can never drift apart.
export const FIREFOX_EXTENSION_UUID = FIREFOX_ADDON_ID.replace(/[{}]/g, "");

export interface ResolvedBuildTarget extends BrowserMeta {
  /** The Nx build configuration name, unchanged. */
  buildConfiguration: string;
  /** Build output dir relative to the repo root. */
  outputDir: string;
}

/**
 * Resolves an Nx build-configuration name to the browser it runs in, its extension URL scheme, and
 * its build output dir. Throws for names whose browser cannot be determined (e.g. `opera`, typos).
 */
export function resolveBuildTarget(target: string): ResolvedBuildTarget {
  const key = Object.keys(SUPPORTED_BROWSERS).find((browser) => target.includes(browser));
  if (!key) {
    throw new Error(
      `Cannot determine a browser for build target "${target}". ` +
        `The name must contain one of: ${Object.keys(SUPPORTED_BROWSERS).join(", ")}.`,
    );
  }

  return {
    ...SUPPORTED_BROWSERS[key],
    buildConfiguration: target,
    outputDir: `dist/apps/browser/${target}`,
  };
}
