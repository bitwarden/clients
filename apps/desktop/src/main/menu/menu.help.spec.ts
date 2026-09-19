import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { SafeShell } from "../../platform/main/safe-shell.main";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

import { AboutMenu } from "./menu.about";
import { HelpMenu } from "./menu.help";

jest.mock("electron", () => ({
  app: { relaunch: jest.fn(), exit: jest.fn() },
}));

jest.mock("../../utils", () => ({
  isMacAppStore: jest.fn().mockReturnValue(false),
  isWindowsStore: jest.fn().mockReturnValue(false),
}));

function makeHelpMenu(): HelpMenu {
  const i18nService = { t: (s: string) => s } as unknown as I18nService;
  const messagingService = { send: jest.fn() } as unknown as MessagingService;
  const desktopSettingsService = {} as unknown as DesktopSettingsService;
  const aboutMenu = { items: [] } as unknown as AboutMenu;
  const shell = { openExternal: jest.fn() } as unknown as SafeShell;
  return new HelpMenu(
    i18nService,
    messagingService,
    desktopSettingsService,
    "https://vault.bitwarden.com",
    false,
    aboutMenu,
    shell,
  );
}

describe("HelpMenu", () => {
  // Regression guard. macOS only renders the Help menu's search field when the
  // top-level Help menu carries role: "help". This has regressed more than once
  // (e.g. https://github.com/bitwarden/clients/issues/2582, and again in 2026),
  // because the role is easy to drop silently while refactoring the menu tree.
  it('declares role "help" so macOS shows the Help menu search field', () => {
    expect(makeHelpMenu().role).toBe("help");
  });

  it('has id "help"', () => {
    expect(makeHelpMenu().id).toBe("help");
  });
});
