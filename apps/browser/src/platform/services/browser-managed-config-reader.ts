import { LogService } from "@bitwarden/logging";
import { createManagementProfile, ManagedSettingsService } from "@bitwarden/managed-settings";

import { BrowserApi } from "../browser/browser-api";

/**
 * Acquires this extension's Unified Endpoint Management (UEM/MDM) profile from the browser's
 * managed storage area and pushes it into {@link ManagedSettingsService}.
 *
 * The browser populates managed storage asynchronously, and an administrator may deploy a policy
 * long after the extension started, so the initial read is backed by a `storage.onChanged`
 * subscription that re-reads whenever the managed area changes.
 *
 * Managed settings are administrator configuration rather than vault data and involve no
 * cryptography. They are still kept out of the log, because a value can disclose an organization's
 * self-hosted infrastructure; only key names and counts are written.
 */
export class BrowserManagedConfigReader {
  constructor(
    private readonly managedSettingsService: ManagedSettingsService,
    private readonly logService: LogService,
  ) {}

  async init(): Promise<void> {
    await this.read();

    BrowserApi.storageChangeListener((_changes, area) => {
      if (area !== "managed") {
        return;
      }

      void this.read();
    });
  }

  private async read(): Promise<void> {
    try {
      const managed = await BrowserApi.getManagedStorage();

      // A browser with no managed storage area can never gain a policy, so there is nothing to
      // clear and nothing that can go stale.
      if (managed == null) {
        this.logService.info("Managed configuration: this browser has no managed storage area.");
        return;
      }

      const profile = createManagementProfile(managed);

      if (profile.settings.size === 0) {
        this.logService.info("Managed configuration: no managed settings are set.");
        this.managedSettingsService.updateProfile(undefined);
        return;
      }

      this.managedSettingsService.updateProfile(profile);

      this.logService.info(
        `Managed configuration: applied ${profile.settings.size} managed setting(s).`,
        [...profile.settings.keys()].sort(),
      );
    } catch (e) {
      // A failed read means the managed state is unknown, not absent, so the last known profile
      // stays in place rather than un-forcing a setting an administrator set. Logged at info
      // because Firefox rejects for every user without a native managed manifest, which is the
      // normal case rather than a fault.
      this.logService.info(
        "Managed configuration: unavailable, keeping the last known profile.",
        e instanceof Error ? e.message : e,
      );
    }
  }
}
