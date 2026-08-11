import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { LinuxManagedSettingsSource } from "./linux-managed-settings.source";
import { MacosManagedSettingsSource } from "./macos-managed-settings.source";
import { ManagedSettingsSource, CONTAINER_VALUE } from "./managed-settings-source";
import { WindowsManagedSettingsSource } from "./windows-managed-settings.source";

export { ManagedSettingsSource, CONTAINER_VALUE };
export { WindowsManagedSettingsSource } from "./windows-managed-settings.source";
export { MacosManagedSettingsSource } from "./macos-managed-settings.source";
export { LinuxManagedSettingsSource } from "./linux-managed-settings.source";

export function managedSettingsSourceFor(
  platform: NodeJS.Platform,
  logService: LogService,
): ManagedSettingsSource {
  switch (platform) {
    case "win32":
      return new WindowsManagedSettingsSource();
    case "darwin":
      return new MacosManagedSettingsSource();
    default:
      return new LinuxManagedSettingsSource(logService);
  }
}
