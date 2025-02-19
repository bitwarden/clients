import { ComponentFixture, fakeAsync, flush, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of, Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  AUTOFILL_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATION_CODE_ID,
} from "@bitwarden/common/autofill/constants";
import { EventType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  ChangeLoginPasswordService,
  CopyCipherFieldService,
  DefaultChangeLoginPasswordService,
  DefaultTaskService,
} from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/popup/browser-popup-utils";
import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";
import { VaultPopupScrollPositionService } from "../../../services/vault-popup-scroll-position.service";

import { VaultPopupAutofillService } from "./../../../services/vault-popup-autofill.service";
import { ViewV2Component } from "./view-v2.component";

// 'qrcode-parser' is used by `BrowserTotpCaptureService` but is an es6 module that jest can't compile.
// Mock the entire module here to prevent jest from throwing an error. I wasn't able to find a way to mock the
// `BrowserTotpCaptureService` where jest would not load the file in the first place.
jest.mock("qrcode-parser", () => {});

describe("ViewV2Component", () => {
  let component: ViewV2Component;
  let fixture: ComponentFixture<ViewV2Component>;
  const params$ = new Subject();
  const mockNavigate = jest.fn();
  const collect = jest.fn().mockResolvedValue(null);
  const doAutofill = jest.fn().mockResolvedValue(true);
  const copy = jest.fn().mockResolvedValue(true);
  const back = jest.fn().mockResolvedValue(null);
  const openSimpleDialog = jest.fn().mockResolvedValue(true);
  const stop = jest.fn();
  const showToast = jest.fn();
  let mockDefaultTaskService: Partial<DefaultTaskService>;
  let mockApiService: Partial<ApiService>;

  const mockCipher = {
    id: "122-333-444",
    type: CipherType.Login,
    orgId: "222-444-555",
    login: {
      username: "test-username",
      password: "test-password",
      totp: "123",
    },
  } as unknown as CipherView;

  const mockVaultPopupAutofillService = {
    doAutofill,
  };
  const mockCopyCipherFieldService = {
    copy,
  };
  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  const mockCipherService = {
    get: jest.fn().mockResolvedValue({ decrypt: jest.fn().mockResolvedValue(mockCipher) }),
    getKeyForCipherKeyDecryption: jest.fn().mockResolvedValue({}),
    deleteWithServer: jest.fn().mockResolvedValue(undefined),
    softDeleteWithServer: jest.fn().mockResolvedValue(undefined),
  };

  const mockPlatformUtilsService = {
    launchUri: jest.fn(),
  };

  const mockChangeLoginPasswordService = {
    getChangePasswordUrl: jest.fn(),
  };

  beforeEach(async () => {
    mockCipherService.deleteWithServer.mockClear();
    mockCipherService.softDeleteWithServer.mockClear();
    mockNavigate.mockClear();
    collect.mockClear();
    doAutofill.mockClear();
    copy.mockClear();
    stop.mockClear();
    openSimpleDialog.mockClear();
    back.mockClear();
    showToast.mockClear();
    mockApiService = {
      send: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ViewV2Component],
      providers: [
        { provide: Router, useValue: { navigate: mockNavigate } },
        { provide: CipherService, useValue: mockCipherService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>({ back }) },
        { provide: ActivatedRoute, useValue: { queryParams: params$ } },
        { provide: EventCollectionService, useValue: { collect } },
        { provide: VaultPopupScrollPositionService, useValue: { stop } },
        { provide: VaultPopupAutofillService, useValue: mockVaultPopupAutofillService },
        { provide: ToastService, useValue: { showToast } },
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...rest: string[]) => {
              if (rest?.length) {
                return `${key} ${rest.join(" ")}`;
              }
              return key;
            },
          },
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: CipherAuthorizationService,
          useValue: {
            canDeleteCipher$: jest.fn().mockReturnValue(true),
            canManageCipher$: jest.fn(),
          },
        },
        {
          provide: CopyCipherFieldService,
          useValue: mockCopyCipherFieldService,
        },
        { provide: DefaultTaskService, useValue: mockDefaultTaskService },
        { provide: StateProvider, useValue: mock<StateProvider>() },
        { provide: ApiService, useValue: mockApiService },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
      ],
    })
      .overrideComponent(ViewV2Component, {
        remove: {
          providers: [
            { provide: ChangeLoginPasswordService, useClass: DefaultChangeLoginPasswordService },
          ],
        },
        add: {
          providers: [
            {
              provide: ChangeLoginPasswordService,
              useValue: mockChangeLoginPasswordService,
            },
          ],
        },
      })
      .overrideProvider(DialogService, {
        useValue: {
          openSimpleDialog,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ViewV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
    jest.spyOn(component, "checkPendingTasks$").mockReturnValue(of(true));
  });

  describe("queryParams", () => {
    it("loads an existing cipher", fakeAsync(() => {
      params$.next({ cipherId: "122-333-444" });

      flush(); // Resolve all promises

      expect(mockCipherService.get).toHaveBeenCalledWith("122-333-444", mockUserId);
      expect(component.cipher).toEqual(mockCipher);
    }));

    it("sets the correct header text", fakeAsync(() => {
      // Set header text for a login
      mockCipher.type = CipherType.Login;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeader typeLogin");

      // Set header text for a card
      mockCipher.type = CipherType.Card;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeader typeCard");

      // Set header text for an identity
      mockCipher.type = CipherType.Identity;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeader typeIdentity");

      // Set header text for a secure note
      mockCipher.type = CipherType.SecureNote;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeader note");
    }));

    it("sends viewed event", fakeAsync(() => {
      params$.next({ cipherId: "122-333-444" });

      flush(); // Resolve all promises

      expect(collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientViewed,
        mockCipher.id,
        false,
        undefined,
      );
    }));

    it('invokes `doAutofill` when action="AUTOFILL_ID"', fakeAsync(() => {
      params$.next({ action: AUTOFILL_ID });

      flush(); // Resolve all promises

      expect(doAutofill).toHaveBeenCalledTimes(1);
    }));

    it('invokes `copy` when action="copy-username"', fakeAsync(() => {
      params$.next({ action: COPY_USERNAME_ID });

      flush(); // Resolve all promises

      expect(copy).toHaveBeenCalledTimes(1);
    }));

    it('invokes `copy` when action="copy-password"', fakeAsync(() => {
      params$.next({ action: COPY_PASSWORD_ID });

      flush(); // Resolve all promises

      expect(copy).toHaveBeenCalledTimes(1);
    }));

    it('invokes `copy` when action="copy-totp"', fakeAsync(() => {
      params$.next({ action: COPY_VERIFICATION_CODE_ID });

      flush(); // Resolve all promises

      expect(copy).toHaveBeenCalledTimes(1);
    }));

    it("closes the popout after a load action", fakeAsync(() => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValueOnce(true);
      jest.spyOn(BrowserPopupUtils, "inSingleActionPopout").mockReturnValueOnce(true);
      const closeSpy = jest.spyOn(BrowserPopupUtils, "closeSingleActionPopout");
      const focusSpy = jest
        .spyOn(BrowserApi, "focusTab")
        .mockImplementation(() => Promise.resolve());

      params$.next({ action: AUTOFILL_ID, senderTabId: 99 });

      flush(); // Resolve all promises

      expect(doAutofill).toHaveBeenCalledTimes(1);
      expect(focusSpy).toHaveBeenCalledWith(99);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    }));
  });

  describe("delete", () => {
    beforeEach(() => {
      component.cipher = mockCipher;
    });

    it("opens confirmation modal", async () => {
      await component.delete();

      expect(openSimpleDialog).toHaveBeenCalledTimes(1);
    });

    it("navigates back", async () => {
      await component.delete();

      expect(back).toHaveBeenCalledTimes(1);
    });

    it("stops scroll position service", async () => {
      await component.delete();

      expect(stop).toHaveBeenCalledTimes(1);
      expect(stop).toHaveBeenCalledWith(true);
    });

    describe("deny confirmation", () => {
      beforeEach(() => {
        openSimpleDialog.mockResolvedValue(false);
      });

      it("does not delete the cipher", async () => {
        await component.delete();

        expect(mockCipherService.deleteWithServer).not.toHaveBeenCalled();
        expect(mockCipherService.softDeleteWithServer).not.toHaveBeenCalled();
      });

      it("does not interact with side effects", () => {
        expect(back).not.toHaveBeenCalled();
        expect(stop).not.toHaveBeenCalled();
        expect(showToast).not.toHaveBeenCalled();
      });
    });

    describe("accept confirmation", () => {
      beforeEach(() => {
        openSimpleDialog.mockResolvedValue(true);
      });

      describe("soft delete", () => {
        beforeEach(() => {
          (mockCipher as any).isDeleted = null;
        });

        it("opens confirmation dialog", async () => {
          await component.delete();

          expect(openSimpleDialog).toHaveBeenCalledTimes(1);
          expect(openSimpleDialog).toHaveBeenCalledWith({
            content: {
              key: "deleteItemConfirmation",
            },
            title: {
              key: "deleteItem",
            },
            type: "warning",
          });
        });

        it("calls soft delete", async () => {
          await component.delete();

          expect(mockCipherService.softDeleteWithServer).toHaveBeenCalled();
          expect(mockCipherService.deleteWithServer).not.toHaveBeenCalled();
        });

        it("shows toast", async () => {
          await component.delete();

          expect(showToast).toHaveBeenCalledWith({
            variant: "success",
            title: null,
            message: "deletedItem",
          });
        });
      });

      describe("hard delete", () => {
        beforeEach(() => {
          (mockCipher as any).isDeleted = true;
        });

        it("opens confirmation dialog", async () => {
          await component.delete();

          expect(openSimpleDialog).toHaveBeenCalledTimes(1);
          expect(openSimpleDialog).toHaveBeenCalledWith({
            content: {
              key: "permanentlyDeleteItemConfirmation",
            },
            title: {
              key: "deleteItem",
            },
            type: "warning",
          });
        });

        it("calls soft delete", async () => {
          await component.delete();

          expect(mockCipherService.deleteWithServer).toHaveBeenCalled();
          expect(mockCipherService.softDeleteWithServer).not.toHaveBeenCalled();
        });

        it("shows toast", async () => {
          await component.delete();

          expect(showToast).toHaveBeenCalledWith({
            variant: "success",
            title: null,
            message: "permanentlyDeletedItem",
          });
        });
      });
    });
  });

  describe("launch URI", () => {
    it("should open url if cipher contains url", async () => {
      const url = "https://example.com";
      component.cipher = {
        ...mockCipher,
        login: { ...mockCipher.login, uris: [{ uri: url }] },
      } as CipherView;
      jest.spyOn(mockChangeLoginPasswordService, "getChangePasswordUrl").mockResolvedValue(url);
      await component.launchChangePassword(component.cipher);

      expect(mockPlatformUtilsService.launchUri).toHaveBeenCalledWith(url);
    });
  });
});
