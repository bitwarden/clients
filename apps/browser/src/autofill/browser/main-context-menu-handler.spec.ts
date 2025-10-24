import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import {
  AUTOFILL_CARD_ID,
  AUTOFILL_ID,
  AUTOFILL_IDENTITY_ID,
  COPY_IDENTIFIER_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATION_CODE_ID,
  NOOP_COMMAND_SUFFIX,
  SEPARATOR_ID,
} from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";

import { MainContextMenuHandler } from "./main-context-menu-handler";

/**
 * Used in place of Set method `symmetricDifference`, which is only available to node version 22.0.0 or greater:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/symmetricDifference
 */
function symmetricDifference(setA: Set<string>, setB: Set<string>) {
  const _difference = new Set(setA);
  for (const elem of setB) {
    if (_difference.has(elem)) {
      _difference.delete(elem);
    } else {
      _difference.add(elem);
    }
  }
  return _difference;
}

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

describe("context-menu", () => {
  let tokenService: MockProxy<TokenService>;
  let autofillSettingsService: MockProxy<AutofillSettingsServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let accountService: MockProxy<AccountService>;
  let restricted$: BehaviorSubject<RestrictedCipherType[]>;
  let restrictedItemTypesService: RestrictedItemTypesService;

  let removeAllSpy: jest.SpyInstance<void, [callback?: () => void]>;
  let createSpy: jest.SpyInstance<
    string | number,
    [createProperties: chrome.contextMenus.CreateProperties, callback?: () => void]
  >;

  let sut: MainContextMenuHandler;

  beforeEach(() => {
    tokenService = mock();
    autofillSettingsService = mock();
    i18nService = mock();
    logService = mock();
    billingAccountProfileStateService = mock();
    accountService = mock();
    restricted$ = new BehaviorSubject<RestrictedCipherType[]>([]);
    restrictedItemTypesService = {
      restricted$,
    } as Partial<RestrictedItemTypesService> as RestrictedItemTypesService;

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
      tokenService,
      autofillSettingsService,
      i18nService,
      logService,
      billingAccountProfileStateService,
      accountService,
      restrictedItemTypesService,
    );

    jest.spyOn(MainContextMenuHandler, "remove");

    autofillSettingsService.enableContextMenu$ = of(true);
    accountService.activeAccount$ = of({
      id: "userId" as UserId,
      email: "",
      emailVerified: false,
      name: undefined,
    });
  });

  afterEach(async () => {
    await MainContextMenuHandler.removeAll();
    jest.resetAllMocks();
  });

  describe("init", () => {
    it("has menu disabled", async () => {
      autofillSettingsService.enableContextMenu$ = of(false);

      const createdMenu = await sut.init();
      expect(createdMenu).toBeFalsy();
      expect(removeAllSpy).toHaveBeenCalledTimes(1);
    });

    it("has menu enabled, but does not have premium", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));

      const createdMenu = await sut.init();
      expect(createdMenu).toBeTruthy();
      expect(createSpy).toHaveBeenCalledTimes(11);
    });

    it("has menu enabled and has premium", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

      const createdMenu = await sut.init();
      expect(createdMenu).toBeTruthy();
      expect(createSpy).toHaveBeenCalledTimes(12);
    });

    it("has menu enabled and has premium, but card type is restricted", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

      restricted$.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);

      const createdMenu = await sut.init();
      expect(createdMenu).toBeTruthy();
      expect(createSpy).toHaveBeenCalledTimes(11);
    });
    it("has menu enabled, does not have premium, and card type is restricted", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      restricted$.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);

      const createdMenu = await sut.init();
      expect(createdMenu).toBeTruthy();
      expect(createSpy).toHaveBeenCalledTimes(10);
    });
  });

  describe("loadOptions", () => {
    it("is not a login cipher", async () => {
      await sut.loadOptions("TEST_TITLE", "1", {
        ...createCipher(),
        type: CipherType.SecureNote,
      } as any);

      expect(createSpy).not.toHaveBeenCalled();
    });

    it("creates item for autofill", async () => {
      const cipher = createCipher({
        username: "",
        totp: "",
        viewPassword: true,
      });
      const optionId = "1";
      await sut.loadOptions("TEST_TITLE", optionId, cipher);

      expect(createSpy).toHaveBeenCalledTimes(2);

      expect(MainContextMenuHandler["existingMenuItems"].size).toEqual(2);

      const expectedMenuItems = new Set([
        AUTOFILL_ID + `_${optionId}`,
        COPY_PASSWORD_ID + `_${optionId}`,
      ]);

      // @TODO Replace with `symmetricDifference` Set method once node 22.0.0 or higher is used
      // const expectedReceivedDiff = expectedMenuItems.symmetricDifference(MainContextMenuHandler["existingMenuItems"])
      const expectedReceivedDiff = symmetricDifference(
        expectedMenuItems,
        MainContextMenuHandler["existingMenuItems"],
      );

      expect(expectedReceivedDiff.size).toEqual(0);
    });

    it("create entry for each cipher piece", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));
      const optionId = "arbitraryString";
      await sut.loadOptions("TEST_TITLE", optionId, createCipher());

      expect(createSpy).toHaveBeenCalledTimes(4);

      expect(MainContextMenuHandler["existingMenuItems"].size).toEqual(4);

      const expectedMenuItems = new Set([
        AUTOFILL_ID + `_${optionId}`,
        COPY_PASSWORD_ID + `_${optionId}`,
        COPY_USERNAME_ID + `_${optionId}`,
        COPY_VERIFICATION_CODE_ID + `_${optionId}`,
      ]);

      // @TODO Replace with `symmetricDifference` Set method once node 22.0.0 or higher is used
      // const expectedReceivedDiff = expectedMenuItems.symmetricDifference(MainContextMenuHandler["existingMenuItems"])
      const expectedReceivedDiff = symmetricDifference(
        expectedMenuItems,
        MainContextMenuHandler["existingMenuItems"],
      );

      expect(expectedReceivedDiff.size).toEqual(0);
    });

    it("creates a login/unlock item for each context menu action option when user is not authenticated", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

      const optionId = "NOOP";
      await sut.loadOptions("TEST_TITLE", optionId);

      expect(createSpy).toHaveBeenCalledTimes(6);

      expect(MainContextMenuHandler["existingMenuItems"].size).toEqual(6);

      const expectedMenuItems = new Set([
        AUTOFILL_ID + `_${optionId}`,
        COPY_PASSWORD_ID + `_${optionId}`,
        COPY_USERNAME_ID + `_${optionId}`,
        COPY_VERIFICATION_CODE_ID + `_${optionId}`,
        AUTOFILL_CARD_ID + `_${optionId}`,
        AUTOFILL_IDENTITY_ID + `_${optionId}`,
      ]);

      // @TODO Replace with `symmetricDifference` Set method once node 22.0.0 or higher is used
      // const expectedReceivedDiff = expectedMenuItems.symmetricDifference(MainContextMenuHandler["existingMenuItems"])
      const expectedReceivedDiff = symmetricDifference(
        expectedMenuItems,
        MainContextMenuHandler["existingMenuItems"],
      );

      expect(expectedReceivedDiff.size).toEqual(0);
    });
  });

  describe("removeBlockedUriMenuItems", () => {
    it("removes menu items that require code injection", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));
      autofillSettingsService.enableContextMenu$ = of(true);
      tokenService.hasAccessToken$.mockReturnValue(of(true));

      const optionId = "1";
      await sut.loadOptions("TEST_TITLE", optionId, createCipher());

      await sut.removeBlockedUriMenuItems();

      expect(MainContextMenuHandler["remove"]).toHaveBeenCalledTimes(6);
      expect(MainContextMenuHandler["remove"]).toHaveBeenCalledWith(AUTOFILL_ID);
      expect(MainContextMenuHandler["remove"]).toHaveBeenCalledWith(AUTOFILL_IDENTITY_ID);
      expect(MainContextMenuHandler["remove"]).toHaveBeenCalledWith(AUTOFILL_CARD_ID);
      expect(MainContextMenuHandler["remove"]).toHaveBeenCalledWith(SEPARATOR_ID + 2);
      expect(MainContextMenuHandler["remove"]).toHaveBeenCalledWith(COPY_IDENTIFIER_ID);

      expect(MainContextMenuHandler["existingMenuItems"].size).toEqual(4);

      const expectedMenuItems = new Set([
        AUTOFILL_ID + `_${optionId}`,
        COPY_PASSWORD_ID + `_${optionId}`,
        COPY_USERNAME_ID + `_${optionId}`,
        COPY_VERIFICATION_CODE_ID + `_${optionId}`,
      ]);

      // @TODO Replace with `symmetricDifference` Set method once node 22.0.0 or higher is used
      // const expectedReceivedDiff = expectedMenuItems.symmetricDifference(MainContextMenuHandler["existingMenuItems"])
      const expectedReceivedDiff = symmetricDifference(
        expectedMenuItems,
        MainContextMenuHandler["existingMenuItems"],
      );

      expect(expectedReceivedDiff.size).toEqual(0);
    });
  });

  describe("creating noAccess context menu items", () => {
    let loadOptionsSpy: jest.SpyInstance;
    beforeEach(() => {
      loadOptionsSpy = jest.spyOn(sut, "loadOptions").mockResolvedValue();
    });

    it("Loads context menu items that ask the user to unlock their vault if they are authed", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));

      await sut.noAccess();

      expect(loadOptionsSpy).toHaveBeenCalledWith("unlockVaultMenu", NOOP_COMMAND_SUFFIX);
    });

    it("Loads context menu items that ask the user to login to their vault if they are not authed", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));

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
