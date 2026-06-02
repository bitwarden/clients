import { globalShortcut } from "electron";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  DEFAULT_QUICK_ACCESS_SHORTCUT,
  isQuickAccessShortcutValid,
} from "../platform/models/domain/quick-access-shortcut";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

import { QuickAccessWindowMain } from "./quick-access-window.main";
import { WindowMain } from "./window.main";

export { DEFAULT_QUICK_ACCESS_SHORTCUT } from "../platform/models/domain/quick-access-shortcut";

export class QuickAccessMain {
  private enabled = true;
  private shortcut = DEFAULT_QUICK_ACCESS_SHORTCUT;
  private registeredShortcut: string | null = null;

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
    private quickAccessWindow: QuickAccessWindowMain,
    private desktopSettingsService: DesktopSettingsService,
  ) {}

  async init() {
    this.enabled = await firstValueFrom(this.desktopSettingsService.quickAccessEnabled$);
    const shortcut = await firstValueFrom(this.desktopSettingsService.quickAccessShortcut$);
    this.shortcut = isQuickAccessShortcutValid(shortcut) ? shortcut : DEFAULT_QUICK_ACCESS_SHORTCUT;
    this.applyShortcutRegistration();
  }

  dispose() {
    this.unregisterRegisteredShortcut();
    this.quickAccessWindow.dispose();
  }

  async toggle() {
    if (!this.enabled) {
      return;
    }

    const wasMainWindowVisible =
      this.windowMain.win != null &&
      !this.windowMain.win.isDestroyed() &&
      this.windowMain.win.isVisible();

    await this.quickAccessWindow.toggle();

    if (
      !wasMainWindowVisible &&
      this.windowMain.win != null &&
      !this.windowMain.win.isDestroyed() &&
      this.windowMain.win.isVisible()
    ) {
      this.windowMain.win.hide();
    }
  }

  hide() {
    this.quickAccessWindow.hide();
  }

  resetWindow() {
    this.quickAccessWindow.dispose();
  }

  send(message: Record<string, unknown>) {
    this.quickAccessWindow.send(message);
  }

  resize(height: number) {
    this.quickAccessWindow.resize(height);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.applyShortcutRegistration();
  }

  setShortcut(shortcut: string) {
    if (!isQuickAccessShortcutValid(shortcut)) {
      this.logService.warning(`Invalid Quick Access shortcut ignored: ${shortcut}`);
      return;
    }

    this.shortcut = shortcut;
    this.applyShortcutRegistration();
  }

  openCipher(cipherId: string, searchText?: string) {
    this.hide();

    if (this.windowMain.win == null || this.windowMain.win.isDestroyed()) {
      return;
    }

    this.windowMain.show();
    this.windowMain.win.focus();
    this.windowMain.win.webContents.send("messagingService", {
      command: "quickAccessOpenCipher",
      cipherId,
      searchText,
    });
  }

  openApp(route: string[] = ["/vault"]) {
    this.hide();

    if (this.windowMain.win == null || this.windowMain.win.isDestroyed()) {
      return;
    }

    this.windowMain.show();
    this.windowMain.win.focus();
    this.windowMain.win.webContents.send("messagingService", {
      command: "quickAccessOpenApp",
      route,
    });
  }

  private applyShortcutRegistration() {
    if (!this.enabled) {
      this.unregisterRegisteredShortcut();
      this.hide();
      return;
    }

    const registeredShortcut = this.registeredShortcut;
    if (registeredShortcut === this.shortcut && globalShortcut.isRegistered(registeredShortcut)) {
      return;
    }

    this.unregisterRegisteredShortcut();
    this.registerShortcut(this.shortcut);
  }

  private registerShortcut(shortcut: string) {
    if (globalShortcut.isRegistered(shortcut)) {
      this.logService.warning(`Quick Access shortcut is already registered: ${shortcut}`);
      return;
    }

    const registered = globalShortcut.register(shortcut, () => {
      void this.toggle();
    });

    if (registered) {
      this.registeredShortcut = shortcut;
      this.logService.info(`Quick Access enabled with shortcut: ${shortcut}`);
    } else {
      this.logService.error(`Failed to enable Quick Access shortcut: ${shortcut}`);
    }
  }

  private unregisterRegisteredShortcut() {
    if (this.registeredShortcut == null) {
      return;
    }

    if (globalShortcut.isRegistered(this.registeredShortcut)) {
      globalShortcut.unregister(this.registeredShortcut);
    }

    this.registeredShortcut = null;
  }
}
