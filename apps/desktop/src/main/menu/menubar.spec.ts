import { MenuItemConstructorOptions } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { SafeShell } from "../../platform/main/safe-shell.main";
import { VersionMain } from "../../platform/main/version.main";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { UpdaterMain } from "../updater.main";
import { WindowMain } from "../window.main";

import { IMenubarMenu, Menubar } from "./menubar";

// Menu.buildFromTemplate is mocked as the identity function so the assembled
// template is observable as the return value of the `menu` getter without
// pulling in Electron's native runtime.
jest.mock("electron", () => ({
  Menu: { buildFromTemplate: jest.fn((template) => template) },
  app: { relaunch: jest.fn(), exit: jest.fn(), getName: jest.fn(), isPackaged: false },
  dialog: { showMessageBox: jest.fn() },
  BrowserWindow: jest.fn(),
  MenuItem: jest.fn(),
  nativeImage: { createFromPath: jest.fn() },
}));

function makeMenubar(): Menubar {
  const i18nService = { t: (s: string) => s } as unknown as I18nService;
  const messagingService = { send: jest.fn() } as unknown as MessagingService;
  const desktopSettingsService = {} as unknown as DesktopSettingsService;
  const updaterMain = { checkForUpdate: jest.fn() } as unknown as UpdaterMain;
  const windowMain = { win: {} } as unknown as WindowMain;
  const versionMain = {} as unknown as VersionMain;
  const shell = { openExternal: jest.fn() } as unknown as SafeShell;
  return new Menubar(
    i18nService,
    messagingService,
    desktopSettingsService,
    updaterMain,
    windowMain,
    "https://vault.bitwarden.com",
    "2026.5.0",
    false,
    versionMain,
    shell,
  );
}

// Returns the assembled top-level menu template (identity-mocked
// buildFromTemplate hands it straight back).
function templateFor(items: Array<IMenubarMenu | null>): MenuItemConstructorOptions[] {
  const menubar = makeMenubar();
  (menubar as any).items = items;
  return menubar.menu as unknown as MenuItemConstructorOptions[];
}

describe("Menubar", () => {
  describe("menu (template assembly)", () => {
    // Regression guard for the role passthrough. macOS only renders the Help
    // menu's search field when the top-level Help menu carries role: "help".
    // The bug was that Menubar dropped `role` while assembling the template, so
    // even a correct HelpMenu.role had no effect. See bitwarden/clients#2582.
    it("forwards a menu's role into the assembled template", () => {
      const template = templateFor([{ id: "help", label: "Help", role: "help", items: [] }]);
      const help = template.find((i) => i.id === "help");
      expect(help?.role).toBe("help");
    });

    it("leaves role undefined for menus that do not declare one", () => {
      const template = templateFor([{ id: "file", label: "File", items: [] }]);
      const file = template.find((i) => i.id === "file");
      expect(file?.role).toBeUndefined();
    });

    it("skips null menu entries", () => {
      const template = templateFor([null, { id: "help", label: "Help", role: "help", items: [] }]);
      expect(template).toHaveLength(1);
      expect(template[0].id).toBe("help");
    });
  });
});
