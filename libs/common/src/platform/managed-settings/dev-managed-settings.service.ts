import { ManagementProfile } from "@bitwarden/sdk-internal";

import { DefaultManagedSettingsService } from "./default-managed-settings.service";
import { flattenSettings } from "./flatten-settings";

/**
 * Development-only {@link ManagedSettingsService} that can be fed a profile from code, so managed
 * settings can be exercised without an actual UEM profile provisioned on the machine. Selected over
 * {@link DefaultManagedSettingsService} at runtime when the `managedSettingsDevSource` dev flag is
 * enabled.
 */
export class DevManagedSettingsService extends DefaultManagedSettingsService {
  /**
   * Flattens a nested settings map to dotted keys with JSON-encoded leaf values and pushes it as a
   * profile. For example `{ environment: { base: "https://vault" } }` becomes the dotted key
   * `environment.base` with the JSON-encoded value `"\"https://vault\""`, matching what an
   * equivalent {@link updateProfile} would store.
   */
  pushExplicit(map: Record<string, unknown>): void {
    const profile: ManagementProfile = {
      version: 1,
      updatedAt: Math.floor(Date.now() / 1000),
      settings: flattenSettings(map),
    };

    this.updateProfile(profile);
  }
}
