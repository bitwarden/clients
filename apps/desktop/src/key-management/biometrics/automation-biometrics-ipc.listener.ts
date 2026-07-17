import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { BiometricsStatus } from "@bitwarden/key-management";

import { AutomationBiometricsService } from "./automation-biometrics.service";

export const AutomationBiometricAction = Object.freeze({
  SetStatus: "setStatus",
  ListPending: "listPending",
  Approve: "approve",
  Deny: "deny",
} as const);
export type AutomationBiometricAction =
  (typeof AutomationBiometricAction)[keyof typeof AutomationBiometricAction];

export type AutomationBiometricMessage = {
  action: AutomationBiometricAction;
  status?: BiometricsStatus;
  id?: string;
};

export const AUTOMATION_BIOMETRIC_CHANNEL = "automation.biometric";

/**
 * Registers the IPC channel that lets the renderer-side automation driver control the
 * {@link AutomationBiometricsService} running in the main process. Only wired up when automation
 * biometrics are active (dev mode + `USE_AUTOMATION_BIOMETRICS`).
 */
export class AutomationBiometricsIPCListener {
  constructor(
    private biometricsService: AutomationBiometricsService,
    private logService: LogService,
  ) {}

  init() {
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
