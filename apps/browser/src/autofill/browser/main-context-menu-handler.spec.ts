import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { NOOP_COMMAND_SUFFIX } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { MainContextMenuHandler } from "./main-context-menu-handler";

describe("context-menu", () => {
  let stateService: MockProxy<StateService>;
  let autofillSettingsService: MockProxy<AutofillSettingsServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;

  let removeAllSpy: jest.SpyInstance<void, [callback?: () => void]>;
  let createSpy: jest.SpyInstance<
    string | number,
    [createProperties: chrome.contextMenus.CreateProperties, callback?: () => void]
  >;

  let sut: MainContextMenuHandler;

  beforeEach(() => {
    stateService = mock();
    autofillSettingsService = mock();
    i18nService = mock();
    logService = mock();
    billingAccountProfileStateService = mock();

    removeAllSpy = jest
      .spyOn(chrome.contextMenus, "removeAll")
      .mockImplementation((callback) => callback());

    createSpy = jest.spyOn(chrome.contextMenus, "create").mockImplementation((props, callback) => {
      if (callback) {
        callback();
      }
      return props.id;
    });

    i18nService.t.mockImplementation((key) => key);
    sut = new MainContextMenuHandler(
      stateService,
      autofillSettingsService,
      i18nService,
      logService,
      billingAccountProfileStateService,
    );
    autofillSettingsService.enableContextMenu$ = of(true);
  });

  afterEach(() => jest.resetAllMocks());

  describe("init", () => {
    it("has menu disabled", async () => {
      autofillSettingsService.enableContextMenu$ = of(false);

      const createdMenu = await sut.init();
      expect(createdMenu).toBeFalsy();
      expect(removeAllSpy).toHaveBeenCalledTimes(1);
    });

    it("has menu enabled, but does not have premium", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$ = of(false);

      const createdMenu = await sut.init();
      expect(createdMenu).toBeTruthy();
      expect(createSpy).toHaveBeenCalledTimes(10);
    });

    it("has menu enabled and has premium", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$ = of(true);

      const createdMenu = await sut.init();
      expect(createdMenu).toBeTruthy();
      expect(createSpy).toHaveBeenCalledTimes(11);
    });
  });

  describe("loadOptions", () => {
    const createCipher = (data?: {
      id?: CipherView["id"];
      username?: CipherView["login"]["username"];
      password?: CipherView["login"]["password"];
      totp?: CipherView["login"]["totp"];
      viewPassword?: CipherView["viewPassword"];
    }): CipherView => {
      const { id, username, password, totp, viewPassword } = data || {};
      const cipherView = new CipherView(
        new Cipher({
          id: id ?? "1",
          type: CipherType.Login,
          viewPassword: viewPassword ?? true,
        } as any),
      );
      cipherView.login.username = username ?? "USERNAME";
      cipherView.login.password = password ?? "PASSWORD";
      cipherView.login.totp = totp ?? "TOTP";
      return cipherView;
    };

    it("is not a login cipher", async () => {
      await sut.loadOptions("TEST_TITLE", "1", {
        ...createCipher(),
        type: CipherType.SecureNote,
      } as any);

      expect(createSpy).not.toHaveBeenCalled();
    });

    it("creates item for autofill", async () => {
      await sut.loadOptions(
        "TEST_TITLE",
        "1",
        createCipher({
          username: "",
          totp: "",
          viewPassword: false,
        }),
      );

      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it("create entry for each cipher piece", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$ = of(true);

      await sut.loadOptions("TEST_TITLE", "1", createCipher());

      // One for autofill, copy username, copy password, and copy totp code
      expect(createSpy).toHaveBeenCalledTimes(4);
    });

    it("creates a login/unlock item for each context menu action option when user is not authenticated", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$ = of(true);

      await sut.loadOptions("TEST_TITLE", "NOOP");

      expect(createSpy).toHaveBeenCalledTimes(6);
    });
  });

  describe("creating noAccess context menu items", () => {
    let loadOptionsSpy: jest.SpyInstance;
    beforeEach(() => {
      loadOptionsSpy = jest.spyOn(sut, "loadOptions").mockResolvedValue();
    });

    it("Loads context menu items that ask the user to unlock their vault if they are authed", async () => {
      stateService.getIsAuthenticated.mockResolvedValue(true);

      await sut.noAccess();

      expect(loadOptionsSpy).toHaveBeenCalledWith("unlockVaultMenu", NOOP_COMMAND_SUFFIX);
    });

    it("Loads context menu items that ask the user to login to their vault if they are not authed", async () => {
      stateService.getIsAuthenticated.mockResolvedValue(false);

      await sut.noAccess();

      expect(loadOptionsSpy).toHaveBeenCalledWith("loginToVaultMenu", NOOP_COMMAND_SUFFIX);
    });
  });

  describe("creating noCards context menu items", () => {
    it("Loads a noCards context menu item and an addCardMenu context item", async () => {
      const noCardsContextMenuItems = sut["noCardsContextMenuItems"];

      await sut.noCards();

      expect(createSpy).toHaveBeenCalledTimes(3);
      expect(createSpy).toHaveBeenCalledWith(noCardsContextMenuItems[0], expect.any(Function));
      expect(createSpy).toHaveBeenCalledWith(noCardsContextMenuItems[1], expect.any(Function));
      expect(createSpy).toHaveBeenCalledWith(noCardsContextMenuItems[2], expect.any(Function));
    });
  });

  describe("creating noIdentities context menu items", () => {
    it("Loads a noIdentities context menu item and an addIdentityMenu context item", async () => {
      const noIdentitiesContextMenuItems = sut["noIdentitiesContextMenuItems"];

      await sut.noIdentities();

      expect(createSpy).toHaveBeenCalledTimes(3);
      expect(createSpy).toHaveBeenCalledWith(noIdentitiesContextMenuItems[0], expect.any(Function));
      expect(createSpy).toHaveBeenCalledWith(noIdentitiesContextMenuItems[1], expect.any(Function));
      expect(createSpy).toHaveBeenCalledWith(noIdentitiesContextMenuItems[2], expect.any(Function));
    });
  });

  describe("creating noLogins context menu items", () => {
    it("Loads a noLogins context menu item and an addLoginMenu context item", async () => {
      const noLoginsContextMenuItems = sut["noLoginsContextMenuItems"];

      await sut.noLogins();

      expect(createSpy).toHaveBeenCalledTimes(5);
      expect(createSpy).toHaveBeenCalledWith(noLoginsContextMenuItems[0], expect.any(Function));
      expect(createSpy).toHaveBeenCalledWith(noLoginsContextMenuItems[1], expect.any(Function));
      expect(createSpy).toHaveBeenCalledWith(
        {
          enabled: false,
          id: "autofill_NOTICE",
          parentId: "autofill",
          title: "noMatchingLogins",
          type: "normal",
        },
        expect.any(Function),
      );
    });
  });
});
