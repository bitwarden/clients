import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/logging";
import { ManagedSettingsService } from "@bitwarden/managed-settings";

import { BrowserApi } from "../browser/browser-api";

/**
 * Acquires this extension's Unified Endpoint Management (UEM/MDM) settings from the browser's
 * managed storage area and passes them to the SDK's `ManagedSettingsClient`, which normalizes them
 * into the active profile.
 *
 * The browser populates managed storage asynchronously, and an administrator may deploy a policy
 * long after the extension started, so the initial read is backed by a `storage.onChanged`
 * subscription that re-reads whenever the managed area changes.
 *
 * Managed settings are administrator configuration rather than vault data and involve no
 * cryptography. They are still kept out of the log, because a value can disclose an organization's
 * self-hosted infrastructure. The SDK logs the key count of every applied profile.
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

      const client = await firstValueFrom(this.managedSettingsService.client$);
      try {
        await client.update_from_json(JSON.stringify(managed));
        this.logService.info("Managed configuration: applied the managed storage area.");
      } catch (e) {
        // The SDK clears the profile when it rejects a value, so a malformed value never leaves
        // an older profile active.
        this.logService.error(
          "Managed configuration: the managed storage area was rejected.",
          e instanceof Error ? e.message : e,
        );
      }
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
