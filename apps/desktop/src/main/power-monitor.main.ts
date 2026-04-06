import { ipcMain, powerMonitor } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { powermonitors } from "@bitwarden/desktop-napi";

import { isSnapStore } from "../utils";

// tslint:disable-next-line
const IdleLockSeconds = 5 * 60; // 5 minutes
const IdleCheckInterval = 30 * 1000; // 30 seconds

export class PowerMonitorMain {
  private idle = false;

  constructor(
    private messagingService: MessageSender,
    private logService: LogService,
  ) {}

  init() {
    // ref: https://github.com/electron/electron/issues/13767
    if (!isSnapStore()) {
      // System sleep
      powerMonitor.on("suspend", () => {
        this.messagingService.send("systemSuspended");
      });
    }

    if (process.platform !== "linux") {
      // System locked
      powerMonitor.on("lock-screen", () => {
        this.messagingService.send("systemLocked");
      });
    } else {
      powermonitors
        .onLock(() => {
          this.messagingService.send("systemLocked");
        })
        .catch((error) => {
          this.logService.error("Error setting up lock monitor", { error });
        });
    }
    ipcMain.handle("powermonitor.isLockMonitorAvailable", async (_event: any, _message: any) => {
      if (process.platform !== "linux") {
        return true;
      } else {
        return await powermonitors.isLockMonitorAvailable();
      }
    });

    // System idle
    global.setInterval(() => {
      const idleSeconds: number = powerMonitor.getSystemIdleTime();
      const idle = idleSeconds >= IdleLockSeconds;
      if (idle) {
        if (this.idle) {
          return;
        }

        this.messagingService.send("systemIdle");
      }

      this.idle = idle;
    }, IdleCheckInterval);
  }
}
