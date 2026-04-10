import { BrowserWindow, dialog, MenuItem } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import * as utils from "../../utils";
import { UpdaterMain } from "../updater.main";

import { FirstMenu } from "./menu.first";
import { MenuAccount } from "./menu.updater";

jest.mock("electron", () => ({
  BrowserWindow: jest.fn(),
  dialog: { showMessageBox: jest.fn() },
  MenuItem: jest.fn(),
}));

jest.mock("../../utils", () => ({
  isMacAppStore: jest.fn().mockReturnValue(false),
  isWindowsStore: jest.fn().mockReturnValue(false),
  isSnapStore: jest.fn().mockReturnValue(false),
}));

function makeAccount(overrides: Partial<MenuAccount> = {}): MenuAccount {
  return {
    userId: "user1",
    email: "user@example.com",
    isAuthenticated: true,
    isLocked: false,
    isLockable: true,
    hasMasterPassword: true,
    multiClientPasswordManagement: false,
    ...overrides,
  };
}

function makeMenu(
  accounts: { [userId: string]: MenuAccount } = {},
  isLocked = false,
  isLockable = true,
): FirstMenu {
  const i18nService = { t: (s: string) => s } as unknown as I18nService;
  const messagingService = { send: jest.fn() } as unknown as MessagingService;
  const updater = { checkForUpdate: jest.fn() } as unknown as UpdaterMain;
  const window = {} as BrowserWindow;
  return new FirstMenu(
    i18nService,
    messagingService,
    updater,
    window,
    accounts,
    isLocked,
    isLockable,
  );
}

describe("FirstMenu", () => {
  describe("hasAccounts", () => {
    it("returns false when accounts is null", () => {
      const menu = makeMenu(null as any);
      expect((menu as any).hasAccounts).toBe(false);
    });

    it("returns false when accounts is empty", () => {
      const menu = makeMenu({});
      expect((menu as any).hasAccounts).toBe(false);
    });

    it("returns true when at least one account exists", () => {
      const menu = makeMenu({ user1: makeAccount() });
      expect((menu as any).hasAccounts).toBe(true);
    });
  });

  describe("hasLockableAccounts", () => {
    it("returns false when accounts is null", () => {
      const menu = makeMenu(null as any);
      expect((menu as any).hasLockableAccounts).toBe(false);
    });

    it("returns false when no accounts are lockable", () => {
      const menu = makeMenu({ user1: makeAccount({ isLockable: false }) });
      expect((menu as any).hasLockableAccounts).toBe(false);
    });

    it("returns false when lockable account is not authenticated", () => {
      const menu = makeMenu({ user1: makeAccount({ isLockable: true, isAuthenticated: false }) });
      expect((menu as any).hasLockableAccounts).toBe(false);
    });

    it("returns false when lockable authenticated account is already locked", () => {
      const menu = makeMenu({
        user1: makeAccount({ isLockable: true, isAuthenticated: true, isLocked: true }),
      });
      expect((menu as any).hasLockableAccounts).toBe(false);
    });

    it("returns true when at least one lockable, authenticated, unlocked account exists", () => {
      const menu = makeMenu({
        user1: makeAccount({ isLockable: true, isAuthenticated: true, isLocked: false }),
      });
      expect((menu as any).hasLockableAccounts).toBe(true);
    });
  });

  describe("hasAuthenticatedAccounts", () => {
    it("returns false when accounts is null", () => {
      const menu = makeMenu(null as any);
      expect((menu as any).hasAuthenticatedAccounts).toBe(false);
    });

    it("returns false when no accounts are authenticated", () => {
      const menu = makeMenu({ user1: makeAccount({ isAuthenticated: false }) });
      expect((menu as any).hasAuthenticatedAccounts).toBe(false);
    });

    it("returns true when at least one account is authenticated", () => {
      const menu = makeMenu({ user1: makeAccount({ isAuthenticated: true }) });
      expect((menu as any).hasAuthenticatedAccounts).toBe(true);
    });
  });

  describe("checkForUpdates", () => {
    const mockedIsMacAppStore = jest.mocked(utils.isMacAppStore);
    const mockedIsWindowsStore = jest.mocked(utils.isWindowsStore);
    const mockedIsSnapStore = jest.mocked(utils.isSnapStore);

    it("is visible when not in any app store", () => {
      mockedIsMacAppStore.mockReturnValue(false);
      mockedIsWindowsStore.mockReturnValue(false);
      mockedIsSnapStore.mockReturnValue(false);
      const menu = makeMenu();
      expect((menu as any).checkForUpdates.visible).toBe(true);
    });

    it("is not visible in mac app store", () => {
      mockedIsMacAppStore.mockReturnValue(true);
      mockedIsWindowsStore.mockReturnValue(false);
      mockedIsSnapStore.mockReturnValue(false);
      const menu = makeMenu();
      expect((menu as any).checkForUpdates.visible).toBe(false);
    });

    it("is not visible in windows store", () => {
      mockedIsMacAppStore.mockReturnValue(false);
      mockedIsWindowsStore.mockReturnValue(true);
      mockedIsSnapStore.mockReturnValue(false);
      const menu = makeMenu();
      expect((menu as any).checkForUpdates.visible).toBe(false);
    });

    it("is not visible in snap store", () => {
      mockedIsMacAppStore.mockReturnValue(false);
      mockedIsWindowsStore.mockReturnValue(false);
      mockedIsSnapStore.mockReturnValue(true);
      const menu = makeMenu();
      expect((menu as any).checkForUpdates.visible).toBe(false);
    });

    afterEach(() => {
      mockedIsMacAppStore.mockReturnValue(false);
      mockedIsWindowsStore.mockReturnValue(false);
      mockedIsSnapStore.mockReturnValue(false);
    });
  });

  describe("settings", () => {
    it("is enabled when not locked", () => {
      const menu = makeMenu({}, false);
      expect((menu as any).settings.enabled).toBe(true);
    });

    it("is disabled when locked", () => {
      const menu = makeMenu({}, true);
      expect((menu as any).settings.enabled).toBe(false);
    });

    it("sends openSettings message on click", () => {
      const menu = makeMenu();
      const messagingService = (menu as any)._messagingService as jest.Mocked<MessagingService>;
      (menu as any).settings.click();
      expect(messagingService.send).toHaveBeenCalledWith("openSettings", undefined);
    });
  });

  describe("lock", () => {
    it("is enabled when lockable accounts exist", () => {
      const menu = makeMenu({ user1: makeAccount() });
      expect((menu as any).lock.enabled).toBe(true);
    });

    it("is disabled when no lockable accounts exist", () => {
      const menu = makeMenu({});
      expect((menu as any).lock.enabled).toBe(false);
    });
  });

  describe("lockSubmenu", () => {
    it("returns empty array when no accounts", () => {
      const menu = makeMenu({});
      expect((menu as any).lockSubmenu).toEqual([]);
    });

    it("excludes accounts that are not lockable", () => {
      const menu = makeMenu({ user1: makeAccount({ isLockable: false }) });
      expect((menu as any).lockSubmenu).toHaveLength(0);
    });

    it("excludes accounts that are not authenticated", () => {
      const menu = makeMenu({ user1: makeAccount({ isAuthenticated: false }) });
      expect((menu as any).lockSubmenu).toHaveLength(0);
    });

    it("includes lockable, authenticated accounts", () => {
      const menu = makeMenu({ user1: makeAccount({ email: "a@b.com", userId: "user1" }) });
      const submenu = (menu as any).lockSubmenu;
      expect(submenu).toHaveLength(1);
      expect(submenu[0].label).toBe("a@b.com");
      expect(submenu[0].id).toBe("lockNow_user1");
    });

    it("sets enabled to false for already-locked accounts", () => {
      const menu = makeMenu({ user1: makeAccount({ isLocked: true }) });
      const submenu = (menu as any).lockSubmenu;
      expect(submenu).toHaveLength(1);
      expect(submenu[0].enabled).toBe(false);
    });

    it("sets enabled to true for unlocked accounts", () => {
      const menu = makeMenu({ user1: makeAccount({ isLocked: false }) });
      const submenu = (menu as any).lockSubmenu;
      expect(submenu[0].enabled).toBe(true);
    });

    it("sends lockVault message with userId on click", () => {
      const menu = makeMenu({ user1: makeAccount({ userId: "user1" }) });
      const messagingService = (menu as any)._messagingService as jest.Mocked<MessagingService>;
      const submenu = (menu as any).lockSubmenu;
      submenu[0].click();
      expect(messagingService.send).toHaveBeenCalledWith("lockVault", { userId: "user1" });
    });

    it("includes multiple accounts", () => {
      const menu = makeMenu({
        user1: makeAccount({ userId: "user1", email: "a@b.com" }),
        user2: makeAccount({ userId: "user2", email: "c@d.com" }),
      });
      expect((menu as any).lockSubmenu).toHaveLength(2);
    });
  });

  describe("lockAll", () => {
    it("is enabled when lockable accounts exist", () => {
      const menu = makeMenu({ user1: makeAccount() });
      expect((menu as any).lockAll.enabled).toBe(true);
    });

    it("is disabled when no lockable accounts exist", () => {
      const menu = makeMenu({});
      expect((menu as any).lockAll.enabled).toBe(false);
    });

    it("sends lockAllVaults message on click", () => {
      const menu = makeMenu({ user1: makeAccount() });
      const messagingService = (menu as any)._messagingService as jest.Mocked<MessagingService>;
      (menu as any).lockAll.click();
      expect(messagingService.send).toHaveBeenCalledWith("lockAllVaults", undefined);
    });
  });

  describe("logOut", () => {
    it("is enabled when authenticated accounts exist", () => {
      const menu = makeMenu({ user1: makeAccount({ isAuthenticated: true }) });
      expect((menu as any).logOut.enabled).toBe(true);
    });

    it("is disabled when no authenticated accounts exist", () => {
      const menu = makeMenu({});
      expect((menu as any).logOut.enabled).toBe(false);
    });
  });

  describe("logOutSubmenu", () => {
    it("returns empty array when no accounts", () => {
      const menu = makeMenu({});
      expect((menu as any).logOutSubmenu).toEqual([]);
    });

    it("includes an entry per account", () => {
      const menu = makeMenu({
        user1: makeAccount({ userId: "user1", email: "a@b.com" }),
        user2: makeAccount({ userId: "user2", email: "c@d.com" }),
      });
      expect((menu as any).logOutSubmenu).toHaveLength(2);
    });

    it("sets visible to true for authenticated accounts", () => {
      const menu = makeMenu({ user1: makeAccount({ isAuthenticated: true }) });
      const submenu = (menu as any).logOutSubmenu;
      expect(submenu[0].visible).toBe(true);
    });

    it("sets visible to false for unauthenticated accounts", () => {
      const menu = makeMenu({ user1: makeAccount({ isAuthenticated: false }) });
      const submenu = (menu as any).logOutSubmenu;
      expect(submenu[0].visible).toBe(false);
    });

    it("sends logout message when dialog confirms", async () => {
      const menu = makeMenu({ user1: makeAccount({ userId: "user1" }) });
      const messagingService = (menu as any)._messagingService as jest.Mocked<MessagingService>;
      (dialog.showMessageBox as jest.Mock).mockResolvedValue({ response: 0 });

      const submenu = (menu as any).logOutSubmenu;
      await submenu[0].click();

      expect(messagingService.send).toHaveBeenCalledWith("logout", { userId: "user1" });
    });

    it("does not send logout message when dialog is cancelled", async () => {
      const menu = makeMenu({ user1: makeAccount({ userId: "user1" }) });
      const messagingService = (menu as any)._messagingService as jest.Mocked<MessagingService>;
      (dialog.showMessageBox as jest.Mock).mockResolvedValue({ response: 1 });

      const submenu = (menu as any).logOutSubmenu;
      await submenu[0].click();

      expect(messagingService.send).not.toHaveBeenCalled();
    });
  });

  describe("checkForUpdate", () => {
    it("calls updater.checkForUpdate and re-enables the menu item", async () => {
      const menu = makeMenu();
      const updater = (menu as any)._updater as jest.Mocked<UpdaterMain>;
      updater.checkForUpdate = jest.fn().mockResolvedValue(undefined);

      const menuItem = { enabled: true } as MenuItem;
      await (menu as any).checkForUpdate(menuItem);

      expect(updater.checkForUpdate).toHaveBeenCalledWith(true);
      expect(menuItem.enabled).toBe(true);
    });
  });

  describe("separator", () => {
    it("has type separator", () => {
      const menu = makeMenu();
      expect((menu as any).separator).toEqual({ type: "separator" });
    });
  });
});
