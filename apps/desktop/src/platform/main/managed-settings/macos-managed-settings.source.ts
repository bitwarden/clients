import { systemPreferences } from "electron";

import { managed_settings } from "@bitwarden/desktop-napi";

import { CONTAINER_VALUE, ManagedSettingsSource } from "./managed-settings-source";

const APP_ID = "com.bitwarden.desktop";
const MANAGEMENT_STATUS_CHANGED = "com.apple.MCX._managementStatusChangedForDomains";
const CHANGED_DOMAINS = "com.apple.MCX.changedDomains";

/**
 * Reads the container value that a configuration profile forces in the `com.bitwarden.desktop`
 * preference domain. A value in the user's own preference domain is ignored, because any process
 * running as the signed-in user can write it.
 */
export class MacOsManagedSettingsSource extends ManagedSettingsSource {
  readonly location = `${APP_ID} ${CONTAINER_VALUE} (forced)`;

  async read(): Promise<string | undefined> {
    // The native read returns only a value that a configuration profile forces.
    return (await managed_settings.read()) ?? undefined;
  }

  async watch(onChanged: () => void): Promise<void> {
    systemPreferences.subscribeNotification(MANAGEMENT_STATUS_CHANGED, (_event, userInfo) => {
      // Posted for every managed domain on the host, several times per profile change. The
      // payload is not a documented contract, so a notification without a domain list re-reads;
      // ManagedSettingsMain drops a re-read whose value is unchanged.
      const domains = userInfo?.[CHANGED_DOMAINS];
      if (!Array.isArray(domains) || domains.includes(APP_ID)) {
        onChanged();
      }
    });
  }
}
