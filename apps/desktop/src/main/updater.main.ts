import { dialog, shell, Notification } from "electron";
import log from "electron-log";
import { autoUpdater, UpdateDownloadedEvent, VerifyUpdateSupport } from "electron-updater";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/logging";

import { isAppImage, isDev, isMacAppStore, isWindowsPortable, isWindowsStore } from "../utils";

import { WindowMain } from "./window.main";

const UpdaterCheckInitialDelay = 5 * 1000; // 5 seconds
const UpdaterCheckInterval = 12 * 60 * 60 * 1000; // 12 hours

const MaxTimeBeforeBlockingUpdateNotification = 7 * 24 * 60 * 60 * 1000; // 7 days

export class UpdaterMain {
  private doingUpdateCheck = false;
  private doingUpdateCheckWithFeedback = false;
  private canUpdate = false;
  private updateDownloaded: UpdateDownloadedEvent = null;
  private originalRolloutFunction: VerifyUpdateSupport = null;

  // This needs to be tracked to avoid the Notification being garbage collected,
  // which would break the click handler.
  private openedNotification: Notification | null = null;

  // This is used to set when the initial update notification was shown.
  // The system notifications can be easy to miss or be disabled, so we want to
  // ensure the user is eventually made aware of the update. If the user does not
  // interact with the notification in a reasonable time, we will prompt them again.
  private initialUpdateNotificationTime: number | null = null;

  constructor(
    private i18nService: I18nService,
    private logService: LogService,
    private windowMain: WindowMain,
  ) {
    autoUpdater.logger = log;

    this.originalRolloutFunction = autoUpdater.isUserWithinRollout;

    const linuxCanUpdate = process.platform === "linux" && isAppImage();
    const windowsCanUpdate =
      process.platform === "win32" && !isWindowsStore() && !isWindowsPortable();
    const macCanUpdate = process.platform === "darwin" && !isMacAppStore();
    this.canUpdate =
      !this.userDisabledUpdates() && (linuxCanUpdate || windowsCanUpdate || macCanUpdate);
  }

  async init() {
    global.setTimeout(async () => await this.checkForUpdate(), UpdaterCheckInitialDelay);
    global.setInterval(async () => await this.checkForUpdate(), UpdaterCheckInterval);

    autoUpdater.on("checking-for-update", () => {
      this.doingUpdateCheck = true;
    });

    autoUpdater.on("update-available", async () => {
      this.initialUpdateNotificationTime ??= Date.now();

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
          await autoUpdater.downloadUpdate();
        } else {
          this.reset();
        }
      }
    });

    autoUpdater.on("update-not-available", async () => {
      if (this.doingUpdateCheckWithFeedback && this.windowMain.win != null) {
        await dialog.showMessageBox(this.windowMain.win, {
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

      this.updateDownloaded = info;
      await this.promptRestartUpdate(info, this.doingUpdateCheckWithFeedback);
    });

    autoUpdater.on("error", (error) => {
      if (this.doingUpdateCheckWithFeedback) {
        dialog.showErrorBox(
          this.i18nService.t("updateError"),
          error == null ? this.i18nService.t("unknown") : (error.stack || error).toString(),
        );
      }

      this.reset();
    });
  }

  async checkForUpdate(withFeedback = false) {
    if (isDev()) {
      return;
    }

    if (this.updateDownloaded && withFeedback) {
      await this.promptRestartUpdate(this.updateDownloaded, true);
      return;
    }

    if (this.doingUpdateCheck) {
      return;
    }

    if (!this.canUpdate) {
      if (withFeedback) {
        void shell.openExternal("https://github.com/bitwarden/clients/releases");
      }

      return;
    }

    this.doingUpdateCheckWithFeedback = withFeedback;
    if (withFeedback) {
      autoUpdater.autoDownload = false;

      // If the user has explicitly checked for updates, we want to bypass
      // the current staging rollout percentage
      autoUpdater.isUserWithinRollout = (info) => true;
    }

    await autoUpdater.checkForUpdates();
  }

  private reset() {
    autoUpdater.autoDownload = true;
    // Reset the rollout check to the default behavior
    autoUpdater.isUserWithinRollout = this.originalRolloutFunction;
    this.doingUpdateCheck = false;
    this.updateDownloaded = null;
  }

  private async promptRestartUpdate(info: UpdateDownloadedEvent, blocking: boolean) {
    // If we have an initial notification, and it's from a long time ago,
    // we will block the user with a dialog to ensure they see it.
    const longTimeSinceInitialNotification =
      this.initialUpdateNotificationTime != null &&
      Date.now() - this.initialUpdateNotificationTime > MaxTimeBeforeBlockingUpdateNotification;

    if (!longTimeSinceInitialNotification && !blocking && Notification.isSupported()) {
      // If the prompt doesn't have to block and we support notifications,
      // we will show a notification instead of a blocking dialog, which won't steal focus.
      await this.promptRestartUpdateUsingSystemNotification(info);
    } else {
      // If we are blocking, or notifications are not supported, we will show a blocking dialog.
      // This will steal the user's focus, so we should only do this for user initiated actions
      // or when there are no other options.
      await this.promptRestartUpdateUsingDialog(info);
    }
  }

  private async promptRestartUpdateUsingSystemNotification(info: UpdateDownloadedEvent) {
    if (this.openedNotification != null) {
      this.openedNotification.close();
    }

    this.openedNotification = new Notification({
      title: this.i18nService.t("bitwarden") + " - " + this.i18nService.t("restartToUpdate"),
      body: this.i18nService.t("restartToUpdateDesc", info.version),
      timeoutType: "never",
      silent: false,
    });

    // If the user clicks the notification, prompt again to restart, this time with a blocking dialog.
    this.openedNotification.on("click", () => {
      void this.promptRestartUpdate(info, true);
    });
    // If the notification fails to show, fall back to the blocking dialog as well.
    this.openedNotification.on("failed", (error) => {
      this.logService.error("Update notification failed", error);
      void this.promptRestartUpdate(info, true);
    });
    this.openedNotification.show();
  }

  private async promptRestartUpdateUsingDialog(info: UpdateDownloadedEvent) {
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
  }

  private userDisabledUpdates(): boolean {
    for (const arg of process.argv) {
      if (arg != null && arg.toUpperCase().indexOf("--ELECTRON_NO_UPDATER=1") > -1) {
        return true;
      }
    }
    return process.env.ELECTRON_NO_UPDATER === "1";
  }
}
