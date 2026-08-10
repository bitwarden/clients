import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  flattenSettings,
  ManagedSettingsService,
} from "@bitwarden/common/platform/managed-settings";
import { ManagementProfile } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

/**
 * Acquires the browser extension's managed configuration from `chrome.storage.managed` and pushes
 * it into the {@link ManagedSettingsService}. The managed store is administrator-controlled through
 * a device's Unified Endpoint Management (UEM/MDM) channel. This is client configuration, not Vault
 * Data, and involves no cryptography.
 *
 * Acquisition fails closed: an unreadable or empty managed store resolves to no profile, clearing
 * any prior profile rather than leaving a partial or forged one in place.
 */
export class BrowserManagedConfigReader {
  constructor(
    private readonly managedSettingsService: ManagedSettingsService,
    private readonly logService: LogService,
  ) {}

  /**
   * Reads the managed store once, then re-reads whenever the managed storage area changes. Call
   * once during startup.
   */
  async start(): Promise<void> {
    await this.refresh();

    BrowserApi.storageChangeListener((_changes, area) => {
      if (area !== "managed") {
        return;
      }

      void this.refresh();
    });
  }

  private async refresh(): Promise<void> {
    let managed: Record<string, unknown> | null;
    try {
      managed = await BrowserApi.getManagedStorage();
    } catch (e) {
      this.logService.error("Managed settings: failed to read managed storage.", e);
      this.managedSettingsService.updateProfile(undefined);
      return;
    }

    const profile = this.normalize(managed);
    if (profile == null) {
      this.logService.info("Managed settings: no managed profile present.");
    } else {
      this.logService.info(
        `Managed settings: applied managed profile with ${profile.settings.size} key(s).`,
      );
    }

    this.managedSettingsService.updateProfile(profile);
  }

  private normalize(managed: Record<string, unknown> | null): ManagementProfile | undefined {
    if (managed == null || Object.keys(managed).length === 0) {
      return undefined;
    }

    return {
      version: 1,
      updatedAt: Math.floor(Date.now() / 1000),
      settings: flattenSettings(managed),
    };
  }
}
