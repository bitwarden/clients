import { LogService } from "@bitwarden/logging";
import { DefaultManagedSettingsService } from "@bitwarden/managed-settings";

/**
 * Renderer-side {@link ManagedSettingsService} for the desktop client. Acquisition happens in the
 * main process, which owns the only access to the host's Unified Endpoint Management channel, so
 * this service applies the profile the main process replicates to it and never reads the host.
 */
export class DesktopManagedSettingsService extends DefaultManagedSettingsService {
  constructor(sdkReady: Promise<void>, logService: LogService) {
    super(sdkReady);

    // Subscribe before pulling, so a push that lands between the two is not lost.
    ipc.platform.managedSettings.onUpdated((profile) => {
      logService.info("Managed settings: applied a profile pushed from the main process.");
      this.updateProfile(profile);
    });
    void ipc.platform.managedSettings.current().then((profile) => {
      // `undefined` here may mean main has not finished its first read. Applying it would clear a
      // profile a push already delivered.
      if (profile != null) {
        this.updateProfile(profile);
      }
    });
  }
}
