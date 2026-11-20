import { ManagementProfile } from "@bitwarden/sdk-internal";

import { flattenSettings } from "./flatten-settings";
import { MANAGEMENT_PROFILE_VERSION } from "./management-profile-version";

/**
 * Builds the profile a host pushes through {@link ManagedSettingsService.updateProfile} from the
 * nested settings object its device-management channel supplied.
 *
 * Every writer goes through here so the schema version and timestamp are stamped one way. The SDK
 * documents `updatedAt` as Unix seconds.
 */
export function createManagementProfile(source: Record<string, unknown>): ManagementProfile {
  return {
    version: MANAGEMENT_PROFILE_VERSION,
    updatedAt: Math.floor(Date.now() / 1000),
    settings: flattenSettings(source),
  };
}
