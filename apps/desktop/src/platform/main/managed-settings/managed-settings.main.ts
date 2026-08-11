import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  flattenSettings,
  ManagedSettingsService,
  ManagementProfile,
} from "@bitwarden/common/platform/managed-settings";

import { WindowMain } from "../../../main/window.main";

import { ManagedSettingsSource } from "./managed-settings-source";

/**
 * Acquires the desktop client's managed configuration from the host's Unified Endpoint
 * Management channel, pushes it into the {@link ManagedSettingsService}, then replicates it to
 * the renderer process, which has no access to the host channel of its own. Acquisition fails
 * closed, so an unreadable, absent, or unparseable container value resolves to no profile,
 * clearing any prior profile rather than leaving a partial or stale one in place.
 */
export class ManagedSettingsMain {
  private profile: ManagementProfile | undefined;

  constructor(
    private readonly source: ManagedSettingsSource,
    private readonly managedSettingsService: ManagedSettingsService,
    private readonly windowMain: WindowMain,
    private readonly logService: LogService,
  ) {
    ipcMain.handle("managedSettings.current", () => this.profile);
  }

  /** Reads the container value once, then re-reads on every change signal. Call once during startup. */
  async init(): Promise<void> {
    await this.refresh();

    try {
      await this.source.watch(() => void this.refresh());
    } catch (e) {
      // The startup read above already applied. A watcher that fails to start is a platform
      // capability problem, not a transient one, so there is nothing to retry.
      this.logService.error("Managed settings: failed to start the host watcher.", e);
    }
  }

  /** The active profile, for the renderer's pull at startup. */
  current(): ManagementProfile | undefined {
    return this.profile;
  }

  private async refresh(): Promise<void> {
    let container: string | undefined;
    try {
      container = await this.source.read();
    } catch (e) {
      this.logService.error("Managed settings: failed to read the host source.", e);
      this.publish(undefined);
      return;
    }

    this.publish(this.normalize(container));
  }

  private normalize(container: string | undefined): ManagementProfile | undefined {
    if (container == null) {
      this.logService.info("Managed settings: the host declares no managed configuration.");
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(container);
    } catch (e) {
      this.logService.error("Managed settings: the container value is not valid JSON.", e);
      return undefined;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      this.logService.error("Managed settings: the container value is not a JSON object.");
      return undefined;
    }

    const settings = flattenSettings(parsed as Record<string, unknown>);
    this.logService.info(`Managed settings: applied ${settings.size} key(s) from the host.`);
    return { version: 1, updatedAt: Math.floor(Date.now() / 1000), settings };
  }

  private publish(profile: ManagementProfile | undefined): void {
    this.profile = profile;
    this.managedSettingsService.updateProfile(profile);
    // `settings` is a Map, which survives Electron's structured clone unchanged. It would not
    // survive a JSON.stringify round-trip.
    this.windowMain.win?.webContents.send("managedSettings.updated", profile);
  }
}
