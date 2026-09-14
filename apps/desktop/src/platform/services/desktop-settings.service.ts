/*
    -- Note --
    
    As of June 2025, settings should only be added here if they are owned
    by the platform team. Other settings should be added to the relevant service
    owned by the team that owns the setting.

    More info: https://bitwarden.atlassian.net/browse/PM-23126
*/

import { Observable, map } from "rxjs";

import {
  DESKTOP_SETTINGS_DISK,
  KeyDefinition,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { SshAgentPromptType } from "../../autofill/models/ssh-agent-setting";
import { isDev } from "../../utils";
import { ModalModeState, WindowState } from "../models/domain/window-state";

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

const RUN_IN_BACKGROUND_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "runInBackground", {
  deserializer: (b) => b,
});

const OPEN_AT_LOGIN_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "openAtLogin", {
  deserializer: (b) => b,
});

const ALWAYS_ON_TOP_KEY = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "alwaysOnTop", {
  deserializer: (b) => b,
});

const SSH_AGENT_ENABLED = new KeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "sshAgentEnabled", {
  deserializer: (b) => b,
});

const SSH_AGENT_PROMPT_BEHAVIOR = new UserKeyDefinition<SshAgentPromptType>(
  DESKTOP_SETTINGS_DISK,
  "sshAgentRememberAuthorizations",
  {
    deserializer: (b) => b,
    clearOn: [],
  },
);

const MINIMIZE_ON_COPY = new UserKeyDefinition<boolean>(DESKTOP_SETTINGS_DISK, "minimizeOnCopy", {
  deserializer: (b) => b,
  clearOn: [], // User setting, no need to clear
});

const MODAL_MODE = new KeyDefinition<ModalModeState>(DESKTOP_SETTINGS_DISK, "modalMode", {
  deserializer: (b) => b,
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

  private readonly runInBackground = this.stateProvider.getGlobal(RUN_IN_BACKGROUND_KEY);
  /**
   * The application setting for whether or not Bitwarden should keep running in the background.
   *
   * When enabled, the system tray icon is shown and closing the window hides the
   * application to the tray (keeping background features such as the SSH agent and
   * biometric unlock available) instead of quitting. When disabled, no tray is shown
   * and closing the window quits the application.
   */
  runInBackground$ = this.runInBackground.state$.pipe(map((v) => v ?? !isDev()));

  private readonly openAtLoginState = this.stateProvider.getGlobal(OPEN_AT_LOGIN_KEY);
  /**
   * The application setting for whether or not the application should open at system login.
   */
  openAtLogin$ = this.openAtLoginState.state$.pipe(map((v) => v ?? !isDev()));

  private readonly alwaysOnTopState = this.stateProvider.getGlobal(ALWAYS_ON_TOP_KEY);

  alwaysOnTop$ = this.alwaysOnTopState.state$.pipe(map(Boolean));

  private readonly sshAgentEnabledState = this.stateProvider.getGlobal(SSH_AGENT_ENABLED);

  sshAgentEnabled$ = this.sshAgentEnabledState.state$.pipe(map(Boolean));

  private readonly sshAgentPromptBehavior = this.stateProvider.getActive(SSH_AGENT_PROMPT_BEHAVIOR);
  sshAgentPromptBehavior$ = this.sshAgentPromptBehavior.state$.pipe(
    map((v) => v ?? SshAgentPromptType.Always),
  );

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

  private readonly modalModeState = this.stateProvider.getGlobal(MODAL_MODE);

  modalMode$ = this.modalModeState.state$;

  constructor(private stateProvider: StateProvider) {
    this.window$ = this.windowState.state$.pipe(
      map((window) =>
        window != null && Object.keys(window).length > 0 ? window : new WindowState(),
      ),
    );
  }

  /**
   * This is used to clear the setting on application start to make sure we don't end up
   * stuck in modal mode if the application is force-closed in modal mode.
   */
  async resetModalMode() {
    await this.modalModeState.update(() => ({ isModalModeActive: false }));
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
   * Sets the setting for whether or not Bitwarden should keep running in the background.
   * @param value `true` if the application should show the tray and hide to it when the window
   * is closed, `false` if closing the window should quit the application.
   */
  async setRunInBackground(value: boolean) {
    await this.runInBackground.update(() => value);
  }

  /**
   * Sets the setting for whether or not the application should open at login of the computer.
   * @param value `true` if the application should open at login, `false` if it should not.
   */
  async setOpenAtLogin(value: boolean) {
    await this.openAtLoginState.update(() => value);
  }

  /**
   * Sets the setting for whether or not the application should stay on top of all other windows.
   * @param value `true` if the application should stay on top, `false` if it should not.
   */
  async setAlwaysOnTop(value: boolean) {
    await this.alwaysOnTopState.update(() => value);
  }

  /**
   * Sets a setting for whether or not the SSH agent is enabled.
   */
  async setSshAgentEnabled(value: boolean) {
    await this.sshAgentEnabledState.update(() => value);
  }

  async setSshAgentPromptBehavior(value: SshAgentPromptType) {
    await this.sshAgentPromptBehavior.update(() => value);
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
   * Sets the modal mode of the application. Setting this changes the windows-size and other properties.
   * @param value `true` if the application is in modal mode, `false` if it is not.
   */
  async setModalMode(
    value: boolean,
    showTrafficButtons?: boolean,
    modalPosition?: { x: number; y: number },
  ) {
    await this.modalModeState.update(() => ({
      isModalModeActive: value,
      showTrafficButtons,
      modalPosition,
    }));
  }

  /**
   * Sets the setting for whether or not the screenshot protection is enabled.
   * @param value `true` if the screenshot protection is enabled, `false` if it is not.
   */
  async setPreventScreenshots(value: boolean) {
    await this.preventScreenshotState.update(() => value);
  }
}
