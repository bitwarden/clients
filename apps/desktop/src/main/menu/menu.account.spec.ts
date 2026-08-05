import { BrowserWindow } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { SafeShell } from "../../platform/main/safe-shell.main";
import * as utils from "../../utils";

import { AccountMenu } from "./menu.account";

jest.mock("electron", () => ({
  BrowserWindow: jest.fn(),
  dialog: { showMessageBox: jest.fn() },
}));

jest.mock("../../utils", () => ({
  isMacAppStore: jest.fn().mockReturnValue(false),
  isWindowsStore: jest.fn().mockReturnValue(false),
}));

function makeMenu(isLocked = false, hasPremium = false): AccountMenu {
  const i18nService = { t: (s: string) => s } as unknown as I18nService;
  const messagingService = { send: jest.fn() } as unknown as MessagingService;
  const window = {} as BrowserWindow;
  const shell = {} as SafeShell;
  return new AccountMenu(
    i18nService,
    messagingService,
    "https://vault.bitwarden.com",
    window,
    isLocked,
    true,
    hasPremium,
    false,
    shell,
    false,
  );
}

describe("AccountMenu", () => {
  const mockedIsMacAppStore = jest.mocked(utils.isMacAppStore);
  const mockedIsWindowsStore = jest.mocked(utils.isWindowsStore);

  afterEach(() => {
    mockedIsMacAppStore.mockReturnValue(false);
    mockedIsWindowsStore.mockReturnValue(false);
  });

  describe("premiumMembership", () => {
    it("is visible when the user does not have premium", () => {
      const menu = makeMenu(false, false);
      expect((menu as any).premiumMembership.visible).toBe(true);
    });

    it("is not visible when the user has premium", () => {
      const menu = makeMenu(false, true);
      expect((menu as any).premiumMembership.visible).toBe(false);
    });

    it("is not visible in the mac app store", () => {
      mockedIsMacAppStore.mockReturnValue(true);
      const menu = makeMenu(false, false);
      expect((menu as any).premiumMembership.visible).toBe(false);
    });

    it("is not visible in the windows store", () => {
      mockedIsWindowsStore.mockReturnValue(true);
      const menu = makeMenu(false, false);
      expect((menu as any).premiumMembership.visible).toBe(false);
    });

    it("is disabled when the vault is locked", () => {
      const menu = makeMenu(true, false);
      expect((menu as any).premiumMembership.enabled).toBe(false);
    });

    it("sends the openPremium message on click", () => {
      const menu = makeMenu();
      const messagingService = (menu as any)._messagingService as jest.Mocked<MessagingService>;
      (menu as any).premiumMembership.click();
      expect(messagingService.send).toHaveBeenCalledWith("openPremium", undefined);
    });
  });
});
