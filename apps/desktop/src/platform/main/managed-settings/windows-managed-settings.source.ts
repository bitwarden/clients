import { managed_settings } from "@bitwarden/desktop-napi";

import { CONTAINER_VALUE, ManagedSettingsSource } from "./managed-settings-source";

/**
 * Reads the container value from the Windows policy registry. Machine policy wins as a whole value,
 * and user policy is read only when the machine holds none.
 */
export class WindowsManagedSettingsSource extends ManagedSettingsSource {
  readonly location = String.raw`SOFTWARE\Policies\Bitwarden\Desktop ${CONTAINER_VALUE} (HKEY_LOCAL_MACHINE, else HKEY_CURRENT_USER)`;

  async read(): Promise<string | undefined> {
    return (await managed_settings.read()) ?? undefined;
  }

  async watch(onChanged: () => void): Promise<void> {
    await managed_settings.watch(() => onChanged());
  }
}
