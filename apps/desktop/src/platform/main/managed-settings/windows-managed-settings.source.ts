import { managed_settings } from "@bitwarden/desktop-napi";

import { CONTAINER_VALUE, ManagedSettingsSource } from "./managed-settings-source";

export class WindowsManagedSettingsSource extends ManagedSettingsSource {
  readonly location = String.raw`HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Bitwarden\Desktop ${CONTAINER_VALUE}`;

  async read(): Promise<string | undefined> {
    return (await managed_settings.read()) ?? undefined;
  }

  async watch(onChanged: () => void): Promise<void> {
    await managed_settings.watch(() => onChanged());
  }
}
