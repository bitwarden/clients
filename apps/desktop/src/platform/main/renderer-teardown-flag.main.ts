import { ipcMain } from "electron";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { RENDERER_TEARDOWN_FLAG_CHANNEL } from "../renderer-teardown-flag";

import { CachedBackend } from "./storage/cached-backend";

/**
 * A single place to determine whether the renderer teardown flag is active. This must only be read
 * once on start-up, because reading from the flag service multiple times may lead to different
 * parts of the app disagreeing about whether the flag is on, which may break functionality.
 *
 * To get the flag state, the app must be restarted.
 */
export class RendererTeardownFlagMain {
  private readonly enabled: boolean;

  constructor(storageBackend: CachedBackend) {
    this.enabled = RendererTeardownFlagMain.readFromCache(storageBackend);
    ipcMain.handle(RENDERER_TEARDOWN_FLAG_CHANNEL, () => this.enabled);
  }

  /** The value every caller in main must use. */
  get isEnabled(): boolean {
    return this.enabled;
  }

  private static readFromCache(storageBackend: CachedBackend): boolean {
    try {
      const configs = (storageBackend.read().global_config_byServer ?? {}) as Record<
        string,
        { featureStates?: Record<string, unknown> }
      >;
      return Object.values(configs).some(
        (config) => config?.featureStates?.[FeatureFlag.DesktopRendererTeardown] === true,
      );
    } catch {
      return false;
    }
  }
}
