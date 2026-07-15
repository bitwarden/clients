// A build target is the name of an Nx build configuration in `apps/browser/project.json`
// (e.g. `chrome-dev`). Every configuration emits to `dist/apps/browser/<configuration-name>`, so
// the output dir needs no suffix arithmetic. Playwright can only load unpacked extensions into
// Chromium, so Chrome is the only supported browser here.

// Browser tokens a build-configuration name may contain; the launch channel is set in the fixture.
export const SUPPORTED_BROWSERS = ["chrome"] as const;

export interface ResolvedBuildTarget {
  /** The Nx build configuration name, unchanged. */
  buildConfiguration: string;
  /** Build output dir relative to the repo root. */
  outputDir: string;
}

/**
 * Resolves an Nx build-configuration name to its build output dir. Throws if the name contains no
 * supported browser token.
 */
export function resolveBuildTarget(target: string): ResolvedBuildTarget {
  const key = SUPPORTED_BROWSERS.find((browser) => target.includes(browser));
  if (!key) {
    throw new Error(
      `Cannot determine a supported browser for build target "${target}". Playwright loads ` +
        `extensions into Chromium only; the name must contain: ${SUPPORTED_BROWSERS.join(", ")}.`,
    );
  }

  return {
    buildConfiguration: target,
    outputDir: `dist/apps/browser/${target}`,
  };
}
