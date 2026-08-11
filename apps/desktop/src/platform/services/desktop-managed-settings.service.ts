import { DefaultManagedSettingsService } from "@bitwarden/common/platform/managed-settings";

/**
 * Renderer-side {@link ManagedSettingsService} for the desktop client. Acquisition happens in the
 * main process, which owns the only access to the host's Unified Endpoint Management channel, so
 * this service applies the profile the main process replicates to it and never reads the host.
 */
export class DesktopManagedSettingsService extends DefaultManagedSettingsService {
  constructor() {
    super();

    // Subscribe before pulling. A push that lands between the two would otherwise be lost.
    ipc.platform.managedSettings.onUpdated((profile) => this.updateProfile(profile));
    void ipc.platform.managedSettings.current().then((profile) => {
      // undefined here means the main process has not resolved a profile yet, not that it
      // resolved to none. Applying it would clear a profile a push had already delivered.
      if (profile != null) {
        this.updateProfile(profile);
      }
    });
  }
}
