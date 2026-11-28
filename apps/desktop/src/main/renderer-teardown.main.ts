import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { WindowMain } from "./window.main";

/** A background feature that only works while a renderer exists. */
export type RendererBlocker = {
  /** Shown in logs, e.g. "ssh-agent". */
  name: string;
  /** Read synchronously: the tray's close handler cannot await. */
  active: () => boolean;
};

/**
 * Destroys the renderer on hide-to-tray, when allowed, instead of hiding it.
 *
 * Destroying the renderer frees most of the app's background memory. Main owns the session, so
 * the vault stays unlocked, but the renderer still answers several background features. Each
 * feature that would break is a {@link RendererBlocker}; while any is active the renderer stays.
 *
 * ```
 *  hideToTray ─▶ tryTearDown() ─ blocked/flag off ─▶ false: caller hides the window
 *                     │
 *                     └─ allowed ─▶ destroy renderer ─▶ true
 * ```
 */
export class RendererTeardownMain {
  constructor(
    private readonly flagEnabled: boolean,
    private readonly blockers: RendererBlocker[],
    private readonly windowMain: WindowMain,
    private readonly logService: LogService,
  ) {}

  /** Destroys the renderer if allowed. Returns whether it did. */
  tryTearDown(): boolean {
    if (!this.allowed()) {
      return false;
    }

    this.logService.info("[Renderer teardown] Destroying renderer");
    this.windowMain.destroyRenderer();
    return true;
  }

  private allowed(): boolean {
    if (!this.flagEnabled) {
      return false;
    }

    const blocker = this.blockers.find((b) => b.active());
    if (blocker != null) {
      this.logService.info(`[Renderer teardown] Keeping renderer, needed by ${blocker.name}`);
      return false;
    }

    return true;
  }
}
