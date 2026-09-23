import { LogService } from "@bitwarden/logging";

import { LinuxManagedSettingsSource } from "./linux-managed-settings.source";
import { MacOsManagedSettingsSource } from "./macos-managed-settings.source";
import { ManagedSettingsSource } from "./managed-settings-source";
import { WindowsManagedSettingsSource } from "./windows-managed-settings.source";

export { CONTAINER_VALUE, ManagedSettingsSource } from "./managed-settings-source";
export { LinuxManagedSettingsSource } from "./linux-managed-settings.source";
export { MacOsManagedSettingsSource } from "./macos-managed-settings.source";
export { WindowsManagedSettingsSource } from "./windows-managed-settings.source";

export function managedSettingsSourceFor(
  platform: NodeJS.Platform,
  logService: LogService,
): ManagedSettingsSource | undefined {
  switch (platform) {
    case "win32":
      return new WindowsManagedSettingsSource();
    case "darwin":
      return new MacOsManagedSettingsSource();
    case "linux":
      return new LinuxManagedSettingsSource(logService);
    default:
      return undefined;
  }
}
