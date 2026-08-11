// Stand-in for PM-27720 (Managed Settings). Dev-only; there is no host to read managed settings
// from, so `pushExplicit` lets a developer simulate one.

import { DefaultManagedSettingsService } from "./default-managed-settings.service";
import { flattenSettings } from "./flatten-settings";

/**
 * Dev-only. Selected behind the `managedSettingsDevSource` dev flag and never runs in a
 * production build.
 */
export class DevManagedSettingsService extends DefaultManagedSettingsService {
  /** Dev-only. Applies `settings` as though a host had declared them. */
  pushExplicit(settings: Record<string, unknown>): void {
    this.updateProfile({
      version: 1,
      updatedAt: Math.floor(Date.now() / 1000),
      settings: flattenSettings(settings),
    });
  }
}
