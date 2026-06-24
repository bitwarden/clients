import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ManagedSettingsService } from "@bitwarden/common/platform/managed-settings/managed-settings.service";

import { BrowserApi } from "../browser/browser-api";

/**
 * Reads the browser's administrator-managed storage area and pushes it into the
 * SDK-backed ManagedSettingsService. Acquisition only — resolution lives in the
 * SDK and the TS overlay. Read failures are logged and swallowed so a malformed
 * admin policy cannot break extension boot.
 */
export class BrowserManagedConfigReader {
  constructor(
    private readonly managedSettings: ManagedSettingsService,
    private readonly logService: LogService,
  ) {}

  async refresh(): Promise<void> {
    try {
      const raw = await BrowserApi.getManagedStorage();
      if (raw == null) {
        return;
      }
      this.managedSettings.pushExplicit(raw);
    } catch (e) {
      this.logService.error("Failed to read managed configuration", e);
    }
  }

  /**
   * Reads once, then re-reads whenever the managed storage area changes. The
   * managed area is not synchronously populated at startup, so the listener is
   * what lets a late-arriving policy propagate instead of being dropped.
   */
  async start(): Promise<void> {
    await this.refresh();
    BrowserApi.storageChangeListener((_changes, area) => {
      if (area === "managed") {
        void this.refresh();
      }
    });
  }
}
