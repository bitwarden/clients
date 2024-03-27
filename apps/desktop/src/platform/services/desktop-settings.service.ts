import { Observable, map } from "rxjs";

import {
  DESKTOP_SETTINGS_DISK,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

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
  closeToTray$ = this.closeToTrayState.state$.pipe(map((value) => value ?? false));

  private readonly minimizeToTrayState = this.stateProvider.getGlobal(MINIMIZE_TO_TRAY_KEY);
  /**
   * The application setting for whether or not to minimize the applicaiton into the system tray.
   */
  minimizeToTray$ = this.minimizeToTrayState.state$.pipe(map((value) => value ?? false));

  private readonly startToTrayState = this.stateProvider.getGlobal(START_TO_TRAY_KEY);
  /**
   * The application setting for whether or not to start the application into the system tray.
   */
  startToTray$ = this.startToTrayState.state$.pipe(map((value) => value ?? false));

  private readonly trayEnabledState = this.stateProvider.getGlobal(TRAY_ENABLED_KEY);
  /**
   * Whether or not the system tray has been enabled.
   */
  trayEnabled$ = this.trayEnabledState.state$.pipe(map((value) => value ?? false));

  private readonly openAtLoginState = this.stateProvider.getGlobal(OPEN_AT_LOGIN_KEY);
  /**
   * The application setting for whether or not the application should open at system login.
   */
  openAtLogin$ = this.openAtLoginState.state$.pipe(map((value) => value ?? false));

  private readonly alwaysShowDockState = this.stateProvider.getGlobal(ALWAYS_SHOW_DOCK_KEY);
  /**
   * The application setting for whether or not the application should show up in the dock.
   */
  alwaysShowDock$ = this.alwaysShowDockState.state$.pipe(map((value) => value ?? false));

  private readonly alwaysOnTopState = this.stateProvider.getGlobal(ALWAYS_ON_TOP_KEY);

  alwaysOnTop$ = this.alwaysOnTopState.state$.pipe(map((value) => value ?? false));

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
   * @param value `true` if the application should should in the dock, `false` if it should not.
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
}
