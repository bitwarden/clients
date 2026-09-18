import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { BiometricsStatus } from "@bitwarden/key-management";

import { WindowMain } from "../../main/window.main";

import {
  AUTOMATION_BIOMETRIC_CHANNEL,
  AUTOMATION_BIOMETRIC_EVENT_CHANNEL,
  AutomationBiometricAction,
  AutomationBiometricMessage,
} from "./automation-biometric-message";
import { AutomationBiometricsService } from "./automation-biometrics.service";

/**
 * Registers the IPC channel that lets the renderer-side automation driver control the
 * {@link AutomationBiometricsService} running in the main process. Only wired up when automation
 * biometrics are active (dev mode + `USE_AUTOMATION_BIOMETRICS`).
 */
export class AutomationBiometricsIPCListener {
  constructor(
    private biometricsService: AutomationBiometricsService,
    private windowMain: WindowMain,
    private logService: LogService,
  ) {}

  init() {
    // Push request activity to the renderer, which surfaces it as a toast.
    this.biometricsService.setEventListener((event) => {
      this.windowMain.win?.webContents.send(AUTOMATION_BIOMETRIC_EVENT_CHANNEL, event);
    });

    ipcMain.handle(
      AUTOMATION_BIOMETRIC_CHANNEL,
      async (event: any, message: AutomationBiometricMessage) => {
        try {
          switch (message.action) {
            case AutomationBiometricAction.SetStatus:
              this.biometricsService.setMockStatus(message.status as BiometricsStatus);
              return;
            case AutomationBiometricAction.ListPending:
              return this.biometricsService.listPendingRequests();
            case AutomationBiometricAction.Approve:
              this.biometricsService.approveRequest(message.id);
              return;
            case AutomationBiometricAction.Deny:
              this.biometricsService.denyRequest(message.id);
              return;
            default:
              return;
          }
        } catch (e) {
          this.logService.error(
            "[Automation Biometrics IPC Listener] %s failed",
            message.action,
            e,
          );
        }
      },
    );
  }
}
