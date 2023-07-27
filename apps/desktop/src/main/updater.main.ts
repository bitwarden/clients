import { dialog, shell } from "electron";
import log from "electron-log";
import { autoUpdater } from "electron-updater";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { isAppImage, isDev, isMacAppStore, isWindowsPortable, isWindowsStore } from "../utils";

import { WindowMain } from "./window.main";

const UpdaterCheckInitialDelay = 5 * 1000; // 5 seconds
const UpdaterCheckInterval = 12 * 60 * 60 * 1000; // 12 hours

export class UpdaterMain {
  private doingUpdateCheck = false;
  private doingUpdateCheckWithFeedback = false;
  private canUpdate = false;

  constructor(private i18nService: I18nService, private windowMain: WindowMain) {
    autoUpdater.logger = log;

    const linuxCanUpdate = process.platform === "linux" && isAppImage();
    const windowsCanUpdate =
      process.platform === "win32" && !isWindowsStore() && !isWindowsPortable();
    const macCanUpdate = process.platform === "darwin" && !isMacAppStore();
    this.canUpdate =
      process.env.ELECTRON_NO_UPDATER !== "1" &&
      (linuxCanUpdate || windowsCanUpdate || macCanUpdate);
  }

  async init() {
    global.setTimeout(async () => await this.checkForUpdate(), UpdaterCheckInitialDelay);
    global.setInterval(async () => await this.checkForUpdate(), UpdaterCheckInterval);

    autoUpdater.on("checking-for-update", () => {
      this.doingUpdateCheck = true;
    });

    autoUpdater.on("update-available", async () => {

      if (this.doingUpdateCheckWithFeedback) {
        if (this.windowMain.win == null) {
          this.reset();
          return;
        }

        const result = await dialog.showMessageBox(this.windowMain.win, {
          type: "info",
          title: this.i18nService.t("bitwarden") + " - " + this.i18nService.t("updateAvailable"),
          message: this.i18nService.t("updateAvailable"),
          detail: this.i18nService.t("updateAvailableDesc"),
          buttons: [this.i18nService.t("yes"), this.i18nService.t("no")],
          cancelId: 1,
          defaultId: 0,
          noLink: true,
        });

        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        } else {
          this.reset();
        }
      }
    });

    autoUpdater.on("update-not-available", () => {
      if (this.doingUpdateCheckWithFeedback && this.windowMain.win != null) {
        dialog.showMessageBox(this.windowMain.win, {
          message: this.i18nService.t("noUpdatesAvailable"),
          buttons: [this.i18nService.t("ok")],
          defaultId: 0,
          noLink: true,
        });
      }

      this.reset();
    });

    autoUpdater.on("update-downloaded", async (info) => {
      if (this.windowMain.win == null) {
        return;
      }

      const result = await dialog.showMessageBox(this.windowMain.win, {
        type: "info",
        title: this.i18nService.t("bitwarden") + " - " + this.i18nService.t("restartToUpdate"),
        message: this.i18nService.t("restartToUpdate"),
        detail: this.i18nService.t("restartToUpdateDesc", info.version),
        buttons: [this.i18nService.t("restart"), this.i18nService.t("later")],
        cancelId: 1,
        defaultId: 0,
        noLink: true,
      });

      if (result.response === 0) {
        // Quit and install have a different window logic, setting `isQuitting` just to be safe.
        this.windowMain.isQuitting = true;
        autoUpdater.quitAndInstall(true, true);
      }
    });

    autoUpdater.on("error", (error) => {
      if (this.doingUpdateCheckWithFeedback) {
        dialog.showErrorBox(
          this.i18nService.t("updateError"),
          error == null ? this.i18nService.t("unknown") : (error.stack || error).toString()
        );
      }

      this.reset();
    });
  }

  async checkForUpdate(withFeedback = false) {
    return;
    if (this.doingUpdateCheck || isDev()) {
      return;
    }

    if (!this.canUpdate) {
      if (withFeedback) {
        shell.openExternal("https://github.com/MichaelLykkeStrand/usteam-clients/releases");
      }

      return;
    }

    this.doingUpdateCheckWithFeedback = withFeedback;
    if (withFeedback) {
      autoUpdater.autoDownload = false;
    }

    await autoUpdater.checkForUpdates();
  }

  private reset() {
    autoUpdater.autoDownload = true;
    this.doingUpdateCheck = false;
  }
}
