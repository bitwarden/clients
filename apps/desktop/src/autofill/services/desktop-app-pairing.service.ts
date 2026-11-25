import { inject, Injectable } from "@angular/core";

import {
  AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION,
  AutotypePairingData,
  AutotypePairingPackagingType,
  isAutotypePairingData,
} from "@bitwarden/common/desktop-native/models/autotype-pairing-data";
import { DesktopAutotypePairingUri } from "@bitwarden/common/desktop-native/models/desktop-autotype-pairing-uri";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { AutotypeRunningApp, autotypeRequestListRunningApps } from "@bitwarden/sdk-internal";
import { AppPairingService } from "@bitwarden/vault";

/** How long to wait for the main process to list the running apps */
export const LIST_RUNNING_APPS_TIMEOUT_MS = 5_000;

/**
 * Lists the running apps a login can be paired with for Autotype. The main process lists them,
 * and they're requested over encrypted IPC.
 */
@Injectable()
export class DesktopAppPairingService implements AppPairingService {
  private ipcService = inject(IpcService);
  private logService = inject(LogService);

  async getRunningApps(signal: AbortSignal): Promise<DesktopAutotypePairingUri[] | null> {
    let apps: AutotypeRunningApp[];
    try {
      const response = await autotypeRequestListRunningApps(
        this.ipcService.client,
        AbortSignal.any([signal, AbortSignal.timeout(LIST_RUNNING_APPS_TIMEOUT_MS)]),
      );
      apps = response.apps;
    } catch (e) {
      // Aborting through `signal` means the apps are no longer needed, so it isn't an error
      if (!signal.aborted) {
        this.logService.error("Failed to list the running apps for Autotype.", e);
      }
      return null;
    }

    // Every app is paired at the time the list arrives, on this client's packaging
    const pairingTimestamp = Math.floor(Date.now() / 1000);
    const packagingType = ipc.platform.isWindowsStore
      ? AutotypePairingPackagingType.WindowsMsix
      : AutotypePairingPackagingType.WindowsExe;

    return (
      apps
        .map((app): AutotypePairingData => ({
          metadata: {
            schemaVersion: { ...AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION },
            pairingTimestamp,
          },
          appData: { name: app.name, normalizedPath: app.path },
          clientData: { packagingType },
        }))
        // Skip apps the schema doesn't allow, like one with an empty name or path
        .filter(isAutotypePairingData)
        .map(
          (data) => new DesktopAutotypePairingUri(DesktopAutotypePairingUri.CurrentVersion, data),
        )
    );
  }
}
