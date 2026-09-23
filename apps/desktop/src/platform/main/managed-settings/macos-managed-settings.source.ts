import { systemPreferences } from "electron";

import { CONTAINER_VALUE, ManagedSettingsSource } from "./managed-settings-source";

export class MacOsManagedSettingsSource extends ManagedSettingsSource {
  // macOS posts this notification to the distributed notification center whenever management
  // status changes, including when a configuration profile is installed, updated, or removed.
  private static readonly managementStatusChangedNotification =
    "com.apple.MCX._managementStatusChangedForDomains";

  readonly location = `com.bitwarden.desktop ${CONTAINER_VALUE}`;

  async read(): Promise<string | undefined> {
    // getUserDefault reads [NSUserDefaults standardUserDefaults], whose search list resolves a
    // value forced by a configuration profile ahead of the user's own application domain. With no
    // profile, a value the user wrote to the application domain is also returned, which the
    // breakdown's Security section accepts.
    const value = systemPreferences.getUserDefault(CONTAINER_VALUE, "string");
    return value ? value : undefined;
  }

  async watch(onChanged: () => void): Promise<void> {
    systemPreferences.subscribeNotification(
      MacOsManagedSettingsSource.managementStatusChangedNotification,
      () => onChanged(),
    );
  }
}
