import { ElectronApplication } from "@playwright/test";

/**
 * Reports a locked screen the way the operating system does: as Electron's `lock-screen` power
 * monitor event in the main process (apps/desktop/src/main/power-monitor.main.ts). The renderer
 * handles it asynchronously; this resolves once the event is emitted.
 */
export async function lockScreen(app: ElectronApplication) {
  await app.evaluate(({ powerMonitor }) => {
    powerMonitor.emit("lock-screen");
  });
}
