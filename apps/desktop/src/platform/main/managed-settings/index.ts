import { LogService } from "@bitwarden/logging";

import { LinuxManagedSettingsSource } from "./linux-managed-settings.source";
import { MacOsManagedSettingsSource } from "./macos-managed-settings.source";
import { ManagedSettingsSource } from "./managed-settings-source";
import { WindowsManagedSettingsSource } from "./windows-managed-settings.source";

export { ManagedSettingsMain } from "./managed-settings.main";
export { ManagedSettingsSource } from "./managed-settings-source";

/** The source that reads the host's managed settings on `platform`, or `undefined` if none. */
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
