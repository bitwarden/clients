import { ComponentFixture, fakeAsync, flush, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of, Subject } from "rxjs";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
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
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { CopyCipherFieldService, PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
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
  const showPasswordPrompt = jest.fn().mockResolvedValue(true);
  const getFeatureFlag$ = jest.fn().mockReturnValue(of(true));

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

  const mockPasswordRepromptService = {
    showPasswordPrompt,
  };
  const mockVaultPopupAutofillService = {
    doAutofill,
  };
  const mockCopyCipherFieldService = {
    copy,
  };
  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  const mockCipherService = {
    cipherViews$: jest.fn().mockImplementation((userId) => of([mockCipher])),
    getKeyForCipherKeyDecryption: jest.fn().mockResolvedValue({}),
    deleteWithServer: jest.fn().mockResolvedValue(undefined),
    softDeleteWithServer: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockCipherService.cipherViews$.mockClear();
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
    showPasswordPrompt.mockClear();

    await TestBed.configureTestingModule({
      imports: [ViewV2Component],
      providers: [
        { provide: Router, useValue: { navigate: mockNavigate } },
        { provide: CipherService, useValue: mockCipherService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>({ back }) },
        { provide: ActivatedRoute, useValue: { queryParams: params$ } },
        { provide: EventCollectionService, useValue: { collect } },
        { provide: VaultPopupScrollPositionService, useValue: { stop } },
        { provide: VaultPopupAutofillService, useValue: mockVaultPopupAutofillService },
        { provide: ToastService, useValue: { showToast } },
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
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
          },
        },
        {
          provide: CopyCipherFieldService,
          useValue: mockCopyCipherFieldService,
        },
        {
          provide: PasswordRepromptService,
          useValue: mockPasswordRepromptService,
        },
      ],
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
  });

  describe("queryParams", () => {
    it("loads an existing cipher", fakeAsync(() => {
      params$.next({ cipherId: "122-333-444" });

      flush(); // Resolve all promises

      expect(mockCipherService.cipherViews$).toHaveBeenCalledWith(mockUserId);
      expect(component.cipher).toEqual(mockCipher);
    }));

    it("sets the correct header text", fakeAsync(() => {
      // Set header text for a login
      mockCipher.type = CipherType.Login;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeaderLogin");

      // Set header text for a card
      mockCipher.type = CipherType.Card;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeaderCard");

      // Set header text for an identity
      mockCipher.type = CipherType.Identity;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeaderIdentity");

      // Set header text for a secure note
      mockCipher.type = CipherType.SecureNote;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeaderNote");
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
      params$.next({ action: AUTOFILL_ID, cipherId: mockCipher.id });

      flush(); // Resolve all promises

      expect(doAutofill).toHaveBeenCalledTimes(1);
    }));

    it('invokes `copy` when action="copy-username"', fakeAsync(() => {
      params$.next({ action: COPY_USERNAME_ID, cipherId: mockCipher.id });

      flush(); // Resolve all promises

      expect(copy).toHaveBeenCalledTimes(1);
    }));

    it('invokes `copy` when action="copy-password"', fakeAsync(() => {
      params$.next({ action: COPY_PASSWORD_ID, cipherId: mockCipher.id });

      flush(); // Resolve all promises

      expect(copy).toHaveBeenCalledTimes(1);
    }));

    it('invokes `copy` when action="copy-totp"', fakeAsync(() => {
      params$.next({ action: COPY_VERIFICATION_CODE_ID, cipherId: mockCipher.id });

      flush(); // Resolve all promises

      expect(copy).toHaveBeenCalledTimes(1);
    }));

    it("does not set the cipher until reprompt is complete", fakeAsync(() => {
      let promptPromise: (val?: unknown) => void;
      mockCipherService.cipherViews$.mockImplementationOnce((userId) =>
        of([
          {
            ...mockCipher,
            reprompt: CipherRepromptType.Password,
          },
        ]),
      );
      doAutofill.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          // store the promise resolver to manually trigger the promise resolve
          promptPromise = resolve;
        });
      });

      params$.next({ action: AUTOFILL_ID, cipherId: mockCipher.id });

      flush(); // Flush all pending actions

      expect(component.cipher).toBeUndefined();
      expect(doAutofill).toHaveBeenCalled();

      promptPromise!(true); // resolve the password prompt

      flush();
      expect(component.cipher).toEqual({ ...mockCipher, reprompt: CipherRepromptType.Password });
    }));

    it("does not set the cipher at all if doAutofill fails and reprompt is active", fakeAsync(() => {
      let promptPromise: (val?: unknown) => void;
      mockCipherService.cipherViews$.mockImplementationOnce((userId) =>
        of([
          {
            ...mockCipher,
            reprompt: CipherRepromptType.Password,
          },
        ]),
      );
      doAutofill.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          // store the promise resolver to manually trigger the promise resolve
          promptPromise = resolve;
        });
      });

      params$.next({ action: AUTOFILL_ID, cipherId: mockCipher.id });

      flush(); // Flush all pending actions

      expect(component.cipher).toBeUndefined();
      expect(doAutofill).toHaveBeenCalled();

      promptPromise!(false); // resolve the password prompt

      flush();
      expect(component.cipher).toBeUndefined();
    }));

    it.each([COPY_PASSWORD_ID, COPY_VERIFICATION_CODE_ID])(
      "does not set cipher when copy fails for %s",
      fakeAsync((action: string) => {
        let promptPromise: (val?: unknown) => void;
        mockCipherService.cipherViews$.mockImplementationOnce((userId) =>
          of([
            {
              ...mockCipher,
              reprompt: CipherRepromptType.Password,
            },
          ]),
        );
        copy.mockImplementationOnce(() => {
          return new Promise((resolve) => {
            // store the promise resolver to manually trigger the promise resolve
            promptPromise = resolve;
          });
        });

        params$.next({ action, cipherId: mockCipher.id });

        flush(); // Flush all pending actions

        expect(component.cipher).toBeUndefined();
        expect(copy).toHaveBeenCalled();

        promptPromise!(false); // resolve the password prompt

        flush();
        expect(component.cipher).toBeUndefined();
      }),
    );

    it("closes the popout after a load action", fakeAsync(() => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValueOnce(true);
      jest.spyOn(BrowserPopupUtils, "inSingleActionPopout").mockReturnValueOnce(true);
      const closeSpy = jest.spyOn(BrowserPopupUtils, "closeSingleActionPopout");
      const focusSpy = jest
        .spyOn(BrowserApi, "focusTab")
        .mockImplementation(() => Promise.resolve());

      params$.next({ action: AUTOFILL_ID, senderTabId: 99, cipherId: mockCipher.id });

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
});
