import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/logging";
import { ManagedSettingsService } from "@bitwarden/managed-settings";

import { ManagedSettingsSource } from "./managed-settings-source";

/**
 * Acquires the host's managed-settings container value in the main process and passes it to the
 * main process's `ManagedSettingsClient`, which normalizes it into the active profile.
 *
 * An absent container value clears the profile, and so does a value the SDK rejects. A read that
 * throws leaves the last known profile active, because the host state is unknown rather than
 * absent.
 */
export class ManagedSettingsMain {
  private hasRead = false;
  // Refreshes run one at a time, so a slow read cannot overwrite the result of a later one.
  private refreshQueue: Promise<void> = Promise.resolve();
  private lastContainer: string | undefined;

  constructor(
    private readonly source: ManagedSettingsSource | undefined,
    private readonly managedSettingsService: ManagedSettingsService,
    private readonly logService: LogService,
  ) {}

  /** Reads the container value once, then re-reads on every change signal. Call once during startup. */
  async init(): Promise<void> {
    const source = this.source;
    if (source == null) {
      this.logService.info(`Managed settings: no source for platform ${process.platform}.`);
      return;
    }
    await this.queueRefresh(source);
    try {
      await source.watch(() => void this.queueRefresh(source));
      this.logService.info(`Managed settings: watching ${source.location}.`);
    } catch (e) {
      this.logService.error(`Managed settings: failed to watch ${source.location}.`, e);
    }
  }

  private queueRefresh(source: ManagedSettingsSource): Promise<void> {
    // A failed refresh is logged and does not stop later refreshes.
    this.refreshQueue = this.refreshQueue
      .then(() => this.refresh(source))
      .catch((e) => this.logService.error("Managed settings: refresh failed.", e));
    return this.refreshQueue;
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
    // Resolved before the value is recorded, so a refresh that fails here is retried with the
    // same value on the next signal.
    const client = await firstValueFrom(this.managedSettingsService.client$);
    this.hasRead = true;
    this.lastContainer = container;
    if (container == null) {
      this.logService.info(`Managed settings: ${source.location} holds no value.`);
    } else {
      this.logService.info(`Managed settings: ${source.location} holds a value.`);
    }
    try {
      await client.update_from_json(container);
    } catch (e) {
      // The SDK clears the profile when it rejects a value, so a malformed value never leaves an
      // older profile active.
      this.logService.error(`Managed settings: the value in ${source.location} was rejected.`, e);
    }
  }
}
