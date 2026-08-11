import { managed_settings } from "@bitwarden/desktop-napi";

import { ManagedSettingsSource } from "./managed-settings-source";

export class WindowsManagedSettingsSource extends ManagedSettingsSource {
  async read(): Promise<string | undefined> {
    const value = await managed_settings.read();
    return value ?? undefined;
  }

  async watch(onChanged: () => void): Promise<void> {
    await managed_settings.watch(() => onChanged());
  }
}
