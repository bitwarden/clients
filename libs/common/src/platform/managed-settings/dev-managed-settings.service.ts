import { ManagementProfile } from "@bitwarden/sdk-internal";

import { DefaultManagedSettingsService } from "./default-managed-settings.service";

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
    const settings = new Map<string, string>();
    this.flatten("", map, settings);

    const profile: ManagementProfile = {
      version: 1,
      updatedAt: Math.floor(Date.now() / 1000),
      settings,
    };

    this.updateProfile(profile);
  }

  private flatten(prefix: string, value: unknown, settings: Map<string, string>): void {
    if (this.isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        this.flatten(prefix === "" ? key : `${prefix}.${key}`, child, settings);
      }
      return;
    }

    settings.set(prefix, JSON.stringify(value));
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }
}
