import { ipcMain } from "electron";

import { LogService } from "@bitwarden/logging";
import { createManagementProfile, ManagedSettingsService } from "@bitwarden/managed-settings";
import { ManagementProfile } from "@bitwarden/sdk-internal";

import { WindowMain } from "../../../main/window.main";

import { ManagedSettingsSource } from "./managed-settings-source";

/**
 * Acquires the desktop client's managed configuration from the host's Unified Endpoint
 * Management channel, pushes it into the {@link ManagedSettingsService}, then replicates it to
 * the renderer process, which has no access to the host channel of its own. An absent or
 * unparseable container value clears the active profile rather than applying a fragment of it.
 *
 * Values are kept out of the log, because a value can disclose an organization's self-hosted
 * infrastructure. Only locations and key counts are written.
 */
export class ManagedSettingsMain {
  private profile: ManagementProfile | undefined;
  private hasRead = false;
  private lastContainer: string | undefined;

  constructor(
    private readonly source: ManagedSettingsSource | undefined,
    private readonly managedSettingsService: ManagedSettingsService,
    private readonly windowMain: WindowMain,
    private readonly logService: LogService,
  ) {
    ipcMain.handle("managedSettings.current", () => this.profile);
  }

  /** Reads the container value once, then re-reads on every change signal. Call once during startup. */
  async init(): Promise<void> {
    const source = this.source;
    if (source == null) {
      this.logService.info(`Managed settings: no source for platform ${process.platform}.`);
      return;
    }

    await this.refresh(source);

    try {
      await source.watch(() => void this.refresh(source));
      this.logService.info(`Managed settings: watching ${source.location}.`);
    } catch (e) {
      // The startup read above already applied. A watcher that fails to start is a platform
      // capability problem, not a transient one, so there is nothing to retry.
      this.logService.error(`Managed settings: failed to watch ${source.location}.`, e);
    }
  }

  /** The active profile, for the renderer's pull at startup. */
  current(): ManagementProfile | undefined {
    return this.profile;
  }

  private async refresh(source: ManagedSettingsSource): Promise<void> {
    let container: string | undefined;
    try {
      container = await source.read();
    } catch (e) {
      // A failed read means the host state is unknown, not absent, so the last known profile
      // stays in place. This matches BrowserManagedConfigReader.
      this.logService.warning(
        `Managed settings: could not read ${source.location}, keeping the last known profile.`,
        e,
      );
      return;
    }

    if (this.hasRead && container === this.lastContainer) {
      return;
    }
    this.hasRead = true;
    this.lastContainer = container;

    this.publish(this.normalize(source, container));
  }

  private normalize(
    source: ManagedSettingsSource,
    container: string | undefined,
  ): ManagementProfile | undefined {
    if (container == null) {
      this.logService.info(`Managed settings: ${source.location} holds no value.`);
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(container);
    } catch {
      // The SyntaxError is not logged, because V8 quotes the offending input in its message.
      this.logService.error(`Managed settings: ${source.location} is not valid JSON.`);
      return undefined;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      this.logService.error(`Managed settings: ${source.location} is not a JSON object.`);
      return undefined;
    }

    const profile = createManagementProfile(parsed as Record<string, unknown>);
    if (profile.settings.size === 0) {
      this.logService.info(`Managed settings: ${source.location} declares no settings.`);
      return undefined;
    }

    this.logService.info(
      `Managed settings: applied ${profile.settings.size} key(s) from ${source.location}.`,
    );
    return profile;
  }

  private publish(profile: ManagementProfile | undefined): void {
    this.profile = profile;
    this.managedSettingsService.updateProfile(profile);
    // `settings` is a Map, which survives Electron's structured clone but not JSON.stringify.
    this.windowMain.win?.webContents.send("managedSettings.updated", profile);
  }
}
