import { systemPreferences } from "electron";

import { CONTAINER_VALUE, ManagedSettingsSource } from "./managed-settings-source";

export class MacosManagedSettingsSource extends ManagedSettingsSource {
  // macOS posts this notification to the distributed notification center whenever management
  // status changes, including when a configuration profile is installed, updated, or removed.
  private static readonly managementStatusChangedNotification =
    "com.apple.MCX._managementStatusChangedForDomains";

  async read(): Promise<string | undefined> {
    // getUserDefault reads [NSUserDefaults standardUserDefaults], whose search list resolves an
    // administrator-forced value ahead of anything the application could have written. The desktop
    // client never writes this key, so a value present here came from a configuration profile.
    const value = systemPreferences.getUserDefault(CONTAINER_VALUE, "string");
    return value ? value : undefined;
  }

  async watch(onChanged: () => void): Promise<void> {
    systemPreferences.subscribeNotification(
      MacosManagedSettingsSource.managementStatusChangedNotification,
      () => onChanged(),
    );
  }
}
