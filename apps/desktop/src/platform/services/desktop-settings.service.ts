import { Observable, map } from "rxjs";

import {
  DESKTOP_SETTINGS_DISK,
  KeyDefinition,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { WindowState } from "../models/domain/window-state";

export const HARDWARE_ACCELERATION = new KeyDefinition<boolean>(
  DESKTOP_SETTINGS_DISK,
  "hardwareAcceleration",
  {
    deserializer: (v: boolean) => v,
  },
);

const WINDOW_KEY = new KeyDefinition<WindowState | null>(DESKTOP_SETTINGS_DISK, "window", {
  deserializer: (s) => s,
});

const CLOSE_TO_TRAY_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "closeToTray", {
  deserializer: (b) => b,
});

const MINIMIZE_TO_TRAY_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "minimizeToTray", {
  deserializer: (b) => b,
});

const START_TO_TRAY_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "startToTray", {
  deserializer: (b) => b,
});

const TRAY_ENABLED_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "trayEnabled", {
  deserializer: (b) => b,
});

const OPEN_AT_LOGIN_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "openAtLogin", {
  deserializer: (b) => b,
});

const ALWAYS_SHOW_DOCK_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "alwaysShowDock", {
  deserializer: (b) => b,
});

const ALWAYS_ON_TOP_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "alwaysOnTop", {
  deserializer: (b) => b,
});

const BROWSER_INTEGRATION_ENABLED = new KeyDefinition<boolean>(
  DESKTOP_SETTINGS_DISK,
  "browserIntegrationEnabled",
  {
    deserializer: (b) => b,
  },
);

const BROWSER_INTEGRATION_FINGERPRINT_ENABLED = new KeyDefinition<boolean>(
  DESKTOP_SETTINGS_DISK,
  "browserIntegrationFingerprintEnabled",
  {
    deserializer: (b) => b,
  },
);

const SSH_AGENT_ENABLED = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "sshAgentEnabled", {
  deserializer: (b) => b,
});

const MINIMIZE_ON_COPY = new UserKeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "minimizeOnCopy", {
  deserializer: (b) => b,
  clearOn: [], // User setting, no need to clear
});

const PREVENT_SCREENSHOTS = new KeyDefinition<boolean>(
  DESKTOP_SETTINGS_DISK,
  "preventScreenshots",
  {
    deserializer: (b) => b,
  },
);

/**
 * Various settings for controlling application behavior specific to the desktop client.
 */
export class DesktopSettingsService {
  private hwState = this.stateProvider.getGlobal(HARDWARE_ACCELERATION);
  hardwareAcceleration$ = this.hwState.state$.pipe(map((v) => v ?? true));

  private readonly windowState = this.stateProvider.getGlobal(WINDOW_KEY);

  private readonly closeToTrayState = this.stateProvider.getGlobal(CLOSE_TO_TRAY_KEY);
  /**
   * Tha applications setting for whether or not to close the application into the system tray.
   */
  closeToTray$ = this.closeToTrayState.state$.pipe(map(Boolean));

  private readonly minimizeToTrayState = this.stateProvider.getGlobal(MINIMIZE_TO_TRAY_KEY);
  /**
   * The application setting for whether or not to minimize the applicaiton into the system tray.
   */
  minimizeToTray$ = this.minimizeToTrayState.state$.pipe(map(Boolean));

  private readonly startToTrayState = this.stateProvider.getGlobal(START_TO_TRAY_KEY);
  /**
   * The application setting for whether or not to start the application into the system tray.
   */
  startToTray$ = this.startToTrayState.state$.pipe(map(Boolean));

  private readonly trayEnabledState = this.stateProvider.getGlobal(TRAY_ENABLED_KEY);
  /**
   * Whether or not the system tray has been enabled.
   */
  trayEnabled$ = this.trayEnabledState.state$.pipe(map(Boolean));

  private readonly openAtLoginState = this.stateProvider.getGlobal(OPEN_AT_LOGIN_KEY);
  /**
   * The application setting for whether or not the application should open at system login.
   */
  openAtLogin$ = this.openAtLoginState.state$.pipe(map(Boolean));

  private readonly alwaysShowDockState = this.stateProvider.getGlobal(ALWAYS_SHOW_DOCK_KEY);
  /**
   * The application setting for whether or not the application should show up in the dock.
   */
  alwaysShowDock$ = this.alwaysShowDockState.state$.pipe(map(Boolean));

  private readonly alwaysOnTopState = this.stateProvider.getGlobal(ALWAYS_ON_TOP_KEY);

  alwaysOnTop$ = this.alwaysOnTopState.state$.pipe(map(Boolean));

  private readonly browserIntegrationEnabledState = this.stateProvider.getGlobal(
    BROWSER_INTEGRATION_ENABLED,
  );

  /**
   * The application setting for whether or not the browser integration is enabled.
   */
  browserIntegrationEnabled$ = this.browserIntegrationEnabledState.state$.pipe(map(Boolean));

  private readonly browserIntegrationFingerprintEnabledState = this.stateProvider.getGlobal(
    BROWSER_INTEGRATION_FINGERPRINT_ENABLED,
  );

  /**
   * The application setting for whether or not the fingerprint should be verified before browser communication.
   */
  browserIntegrationFingerprintEnabled$ =
    this.browserIntegrationFingerprintEnabledState.state$.pipe(map(Boolean));

  private readonly sshAgentEnabledState = this.stateProvider.getGlobal(SSH_AGENT_ENABLED);

  sshAgentEnabled$ = this.sshAgentEnabledState.state$.pipe(map(Boolean));

  private readonly preventScreenshotState = this.stateProvider.getGlobal(PREVENT_SCREENSHOTS);

  /**
   * The application setting for whether or not to allow screenshots of the app.
   */
  preventScreenshots$ = this.preventScreenshotState.state$.pipe(map(Boolean));

  private readonly minimizeOnCopyState = this.stateProvider.getActive(MINIMIZE_ON_COPY);

  /**
   * The active users setting for whether or not the application should minimize itself
   * when a value is copied to the clipboard.
   */
  minimizeOnCopy$ = this.minimizeOnCopyState.state$.pipe(map(Boolean));

  constructor(private stateProvider: StateProvider) {
    this.window$ = this.windowState.state$.pipe(
      map((window) =>
        window != null && Object.keys(window).length > 0 ? window : new WindowState(),
      ),
    );
  }

  async setHardwareAcceleration(enabled: boolean) {
    await this.hwState.update(() => enabled);
  }

  /**
   * The applications current window state.
   */
  window$: Observable<WindowState>;

  /**
   * Updates the window state of the application so that the application can reopen in the same place as it was closed from.
   * @param windowState The window state to set.
   */
  async setWindow(windowState: WindowState) {
    await this.windowState.update(() => windowState);
  }

  /**
   * Sets the setting for whether or not the application should go into the system tray when closed.
   * @param value `true` if the application should go into the system tray when closed, `false` if it should not.
   */
  async setCloseToTray(value: boolean) {
    await this.closeToTrayState.update(() => value);
  }

  /**
   * Sets the setting for whether or not the application should go into the tray when minimized.
   * @param value `true` if the application should minimize into the system tray, `false` if it should not.
   */
  async setMinimizeToTray(value: boolean) {
    await this.minimizeToTrayState.update(() => value);
  }

  /**
   * Sets the setting for whether or not the application should be started into the system tray.
   * @param value `true` if the application should be started to the tray`, `false` if it should not.
   */
  async setStartToTray(value: boolean) {
    await this.startToTrayState.update(() => value);
  }

  /**
   * Sets the setting for whether or not the application be shown in the system tray.
   * @param value `true` if the application should show in the tray, `false` if it should not.
   */
  async setTrayEnabled(value: boolean) {
    await this.trayEnabledState.update(() => value);
  }

  /**
   * Sets the setting for whether or not the application should open at login of the computer.
   * @param value `true` if the application should open at login, `false` if it should not.
   */
  async setOpenAtLogin(value: boolean) {
    await this.openAtLoginState.update(() => value);
  }

  /**
   * Sets the setting for whether or not the application should be shown in the dock.
   * @param value `true` if the application should show in the dock, `false` if it should not.
   */
  async setAlwaysShowDock(value: boolean) {
    await this.alwaysShowDockState.update(() => value);
  }

  /**
   * Sets the setting for whether or not the application should stay on top of all other windows.
   * @param value `true` if the application should stay on top, `false` if it should not.
   */
  async setAlwaysOnTop(value: boolean) {
    await this.alwaysOnTopState.update(() => value);
  }

  /**
   * Sets a setting for whether or not the browser integration has been enabled.
   * @param value `true` if the integration with the browser extension is enabled,
   * `false` if it is not.
   */
  async setBrowserIntegrationEnabled(value: boolean) {
    await this.browserIntegrationEnabledState.update(() => value);
  }

  /**
   * Sets a setting for whether or not the browser fingerprint should be verified before
   * communication with the browser integration should be done.
   * @param value `true` if the fingerprint should be validated before use, `false` if it should not.
   */
  async setBrowserIntegrationFingerprintEnabled(value: boolean) {
    await this.browserIntegrationFingerprintEnabledState.update(() => value);
  }

  /**
   * Sets a setting for whether or not the SSH agent is enabled.
   */
  async setSshAgentEnabled(value: boolean) {
    await this.sshAgentEnabledState.update(() => value);
  }

  /**
   * Sets the minimize on copy value for the current user.
   * @param value `true` if the application should minimize when a value is copied,
   * `false` if it should not.
   * @param userId The user id of the user to update the setting for.
   */
  async setMinimizeOnCopy(value: boolean, userId: UserId) {
    await this.stateProvider.getUser(userId, MINIMIZE_ON_COPY).update(() => value);
  }

  /**
   * Sets the setting for whether or not the screenshot protection is enabled.
   * @param value `true` if the screenshot protection is enabled, `false` if it is not.
   */
  async setPreventScreenshots(value: boolean) {
    await this.preventScreenshotState.update(() => value);
  }
}
