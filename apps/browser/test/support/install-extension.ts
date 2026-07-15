import * as fs from "node:fs";
import * as path from "node:path";

import { browser } from "@wdio/globals";

import { FIREFOX_EXTENSION_UUID, resolveBuildTarget } from "./build-targets";

export interface InstalledExtension {
  id: string;
  /** Builds a popup URL, e.g. `popupUrl("#/login")`. */
  popupUrl: (hashRoute?: string) => string;
}

let installed: InstalledExtension | undefined;

const repoRoot = path.resolve(__dirname, "../../../..");

/**
 * Installs the built, unpacked extension into the running browser via the WebDriver BiDi
 * `webExtension.install` command and returns its runtime id plus a popup-URL builder. Call once per
 * session from the WDIO `before()` hook; specs read the handle back via {@link getExtension}.
 */
export async function installExtension(): Promise<InstalledExtension> {
  // The active session's build target, stashed on its capability by the WDIO config. Read from
  // `requestedCapabilities`, which preserves custom keys verbatim (the driver strips them from
  // `capabilities`).
  const target =
    ((browser.requestedCapabilities as Record<string, unknown>)["bw:buildTarget"] as string) ??
    "chrome-dev";
  const { outputDir, scheme } = resolveBuildTarget(target);

  const extensionPath = path.join(repoRoot, outputDir);
  if (!fs.existsSync(path.join(extensionPath, "manifest.json"))) {
    throw new Error(
      `Built extension not found at ${extensionPath}. The WDIO \`onPrepare\` build should have ` +
        `produced it — check the build output above, or run \`npx nx build browser ` +
        `--configuration=${target}\` manually. (Set SKIP_BUILD=true only if building separately.)`,
    );
  }

  const result = await browser.webExtensionInstall({
    extensionData: { type: "path", path: extensionPath },
  });
  const id = result.extension;

  // Chrome/Edge serve extension pages from `chrome-extension://<install-id>`, so the installed id is
  // the popup host. Firefox uses a per-profile `moz-extension://<UUID>` origin instead, pinned to
  // `FIREFOX_EXTENSION_UUID` (see build-targets.ts).
  const popupHost = scheme === "moz-extension" ? FIREFOX_EXTENSION_UUID : id;

  installed = {
    id,
    popupUrl: (hashRoute = "") => `${scheme}://${popupHost}/popup/index.html${hashRoute}`,
  };
  return installed;
}

export function getExtension(): InstalledExtension {
  if (!installed) {
    throw new Error("Extension not installed; installExtension() must run in the before() hook.");
  }
  return installed;
}
