import { TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith, subscribeTo } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { ToastService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import {
  AutoFillOptions,
  AutofillService,
  PageDetail,
} from "../../../autofill/services/abstractions/autofill.service";
import { InlineMenuFieldQualificationService } from "../../../autofill/services/inline-menu-field-qualification.service";
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

import { VaultPopupAutofillService } from "./vault-popup-autofill.service";

describe("VaultPopupAutofillService", () => {
  let testBed: TestBed;
  let service: VaultPopupAutofillService;

  const mockCurrentTab = { url: "https://example.com" } as chrome.tabs.Tab;
  const mockActivatedRoute = {
    queryParams: of({}),
  } as any;

  // Create mocks for VaultPopupAutofillService
  const mockAutofillService = mock<AutofillService>();
  const mockDomainSettingsService = mock<DomainSettingsService>();
  const mockI18nService = mock<I18nService>();
  const mockToastService = mock<ToastService>();
  const mockPlatformUtilsService = mock<PlatformUtilsService>();
  const mockPasswordRepromptService = mock<PasswordRepromptService>();
  const mockCipherService = mock<CipherService>();
  const mockMessagingService = mock<MessagingService>();
  const mockInlineMenuFieldQualificationService = mock<InlineMenuFieldQualificationService>();
  const mockLogService = mock<LogService>();

  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  beforeEach(() => {
    jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);
    jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(mockCurrentTab);
    jest
      .spyOn(mockInlineMenuFieldQualificationService, "isFieldForCreditCardForm")
      .mockReturnValue(true);
    jest
      .spyOn(mockInlineMenuFieldQualificationService, "isFieldForIdentityForm")
      .mockReturnValue(true);

    mockAutofillService.collectPageDetailsFromTab$.mockReturnValue(new BehaviorSubject([]));
    mockDomainSettingsService.blockedInteractionsUris$ = new BehaviorSubject({});

    testBed = TestBed.configureTestingModule({
      providers: [
        { provide: AutofillService, useValue: mockAutofillService },
        { provide: DomainSettingsService, useValue: mockDomainSettingsService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: PasswordRepromptService, useValue: mockPasswordRepromptService },
        { provide: CipherService, useValue: mockCipherService },
        { provide: MessagingService, useValue: mockMessagingService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: InlineMenuFieldQualificationService,
          useValue: mockInlineMenuFieldQualificationService,
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    });

    service = testBed.inject(VaultPopupAutofillService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("currentAutofillTab$", () => {
    it("should return null if in popout", (done) => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);
      service.refreshCurrentTab();
      service.currentAutofillTab$.subscribe((tab) => {
        expect(tab).toBeNull();
        done();
      });
    });

    it("should return BrowserApi.getTabFromCurrentWindow() if not in popout", (done) => {
      service.currentAutofillTab$.subscribe((tab) => {
        expect(tab).toEqual(mockCurrentTab);
        expect(BrowserApi.getTabFromCurrentWindow).toHaveBeenCalled();
        done();
      });
    });

    it("should only fetch the current tab once when subscribed to multiple times", async () => {
      const firstTracked = subscribeTo(service.currentAutofillTab$);
      const secondTracked = subscribeTo(service.currentAutofillTab$);

      await firstTracked.pauseUntilReceived(1);
      await secondTracked.pauseUntilReceived(1);

      expect(BrowserApi.getTabFromCurrentWindow).toHaveBeenCalledTimes(1);
    });
  });

  describe("autofillAllowed$", () => {
    it("should return true if there is a current tab", (done) => {
      service.autofillAllowed$.subscribe((allowed) => {
        expect(allowed).toBe(true);
        done();
      });
    });

    it("should return false if there is no current tab", (done) => {
      jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(null);
      service.refreshCurrentTab();
      service.autofillAllowed$.subscribe((allowed) => {
        expect(allowed).toBe(false);
        done();
      });
    });

    it("should return false if in a popout", (done) => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);
      service.refreshCurrentTab();
      service.autofillAllowed$.subscribe((allowed) => {
        expect(allowed).toBe(false);
        done();
      });
    });
  });

  describe("refreshCurrentTab()", () => {
    it("should refresh currentAutofillTab$", async () => {
      const tracked = subscribeTo(service.currentAutofillTab$);
      service.refreshCurrentTab();
      await tracked.pauseUntilReceived(2);
    });
  });

  describe("autofill methods", () => {
    const mockPageDetails: PageDetail[] = [{ tab: mockCurrentTab, details: {} as any, frameId: 1 }];
    let mockCipher: CipherView;
    let expectedAutofillArgs: AutoFillOptions;
    let mockPageDetails$: BehaviorSubject<PageDetail[]>;

    beforeEach(() => {
      mockCipher = new CipherView();
      mockCipher.type = CipherType.Login;

      mockPageDetails$ = new BehaviorSubject(mockPageDetails);

      mockAutofillService.collectPageDetailsFromTab$.mockReturnValue(mockPageDetails$);

      expectedAutofillArgs = {
        tab: mockCurrentTab,
        cipher: mockCipher,
        pageDetails: mockPageDetails,
        doc: expect.any(Document),
        fillNewPassword: true,
        allowTotpAutofill: true,
      };

      // Refresh the current tab so the mockedPageDetails$ are used
      service.refreshCurrentTab();
    });

    describe("doAutofill()", () => {
      it("should return true if autofill is successful", async () => {
        mockAutofillService.doAutoFill.mockResolvedValue(null);
        const result = await service.doAutofill(mockCipher);
        expect(result).toBe(true);
        expect(mockAutofillService.doAutoFill).toHaveBeenCalledWith(expectedAutofillArgs);
      });

      it("should return false if autofill is not successful", async () => {
        mockAutofillService.doAutoFill.mockRejectedValue(null);
        const result = await service.doAutofill(mockCipher);
        expect(result).toBe(false);
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: null,
          message: mockI18nService.t("autofillError"),
        });
      });

      it("should return false if tab is null", async () => {
        jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(null);
        const result = await service.doAutofill(mockCipher);
        expect(result).toBe(false);
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: null,
          message: mockI18nService.t("autofillError"),
        });
      });

      it("should return false if missing page details", async () => {
        mockPageDetails$.next([]);
        const result = await service.doAutofill(mockCipher);
        expect(result).toBe(false);
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: null,
          message: mockI18nService.t("autofillError"),
        });
      });

      it("should show password prompt if cipher requires reprompt", async () => {
        mockCipher.reprompt = CipherRepromptType.Password;
        mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);
        const result = await service.doAutofill(mockCipher);
        expect(result).toBe(false);
      });

      it("should copy TOTP code to clipboard if available", async () => {
        const totpCode = "123456";
        mockAutofillService.doAutoFill.mockResolvedValue(totpCode);
        await service.doAutofill(mockCipher);
        expect(mockPlatformUtilsService.copyToClipboard).toHaveBeenCalledWith(
          totpCode,
          expect.anything(),
        );
      });

      describe("closePopup", () => {
        beforeEach(() => {
          jest.spyOn(BrowserApi, "closePopup").mockImplementation();
          jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(true);
          mockPlatformUtilsService.isFirefox.mockReturnValue(true);
          jest.useFakeTimers();
        });

        afterEach(() => {
          jest.useRealTimers();
        });

        it("should close popup by default when in popup", async () => {
          await service.doAutofill(mockCipher);
          expect(BrowserApi.closePopup).toHaveBeenCalled();
        });

        it("should not close popup when closePopup is set to false", async () => {
          await service.doAutofill(mockCipher, false);
          expect(BrowserApi.closePopup).not.toHaveBeenCalled();
        });

        it("should close popup after a timeout for chromium browsers", async () => {
          mockPlatformUtilsService.isFirefox.mockReturnValue(false);
          jest.spyOn(global, "setTimeout");
          await service.doAutofill(mockCipher);
          jest.advanceTimersByTime(50);
          expect(setTimeout).toHaveBeenCalledTimes(1);
          expect(BrowserApi.closePopup).toHaveBeenCalled();
        });

        it("should show a successful toast message if login form is populated", async () => {
          jest.spyOn(BrowserPopupUtils, "inSingleActionPopout").mockReturnValue(true);
          (service as any).currentAutofillTab$ = of({ id: 1234 });
          await service.doAutofill(mockCipher);
          expect(mockToastService.showToast).toHaveBeenCalledWith({
            variant: "success",
            title: null,
            message: mockI18nService.t("autoFillSuccess"),
          });
        });
      });
    });

    describe("doAutofillAndSave()", () => {
      beforeEach(() => {
        // Mocks for service._closePopup()
        jest.spyOn(BrowserApi, "closePopup").mockImplementation();
        jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(true);
        mockPlatformUtilsService.isFirefox.mockReturnValue(true);

        // Default to happy path
        mockAutofillService.doAutoFill.mockResolvedValue(null);
        mockCipherService.updateWithServer.mockResolvedValue(null);
      });

      it("should return false if cipher is not login type", async () => {
        mockCipher.type = CipherType.Card;
        const result = await service.doAutofillAndSave(mockCipher);
        expect(result).toBe(false);
        expect(mockAutofillService.doAutoFill).not.toHaveBeenCalled();
      });

      it("should return false if autofill is not successful", async () => {
        mockAutofillService.doAutoFill.mockRejectedValue(null);
        const result = await service.doAutofillAndSave(mockCipher);
        expect(result).toBe(false);
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: null,
          message: mockI18nService.t("autofillError"),
        });
      });

      it("should return true if the cipher already has a URI for the tab", async () => {
        mockCipher.login = new LoginView();
        mockCipher.login.uris = [{ uri: mockCurrentTab.url } as LoginUriView];
        const result = await service.doAutofillAndSave(mockCipher);
        expect(result).toBe(true);
        expect(BrowserApi.closePopup).toHaveBeenCalled();
        expect(mockCipherService.updateWithServer).not.toHaveBeenCalled();
      });

      it("should show a success toast if closePopup is false and cipher already has URI for tab", async () => {
        mockCipher.login = new LoginView();
        mockCipher.login.uris = [{ uri: mockCurrentTab.url } as LoginUriView];
        const result = await service.doAutofillAndSave(mockCipher, false);
        expect(result).toBe(true);
        expect(BrowserApi.closePopup).not.toHaveBeenCalled();
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          title: null,
          message: mockI18nService.t("autoFillSuccessAndSavedUri"),
        });
        expect(mockCipherService.updateWithServer).not.toHaveBeenCalled();
      });

      it("should add a URI to the cipher and save with the server", async () => {
        const mockEncryptedCipher = { cipher: {} as Cipher, encryptedFor: mockUserId };
        mockCipherService.encrypt.mockResolvedValue(mockEncryptedCipher);
        const result = await service.doAutofillAndSave(mockCipher);
        expect(result).toBe(true);
        expect(mockCipher.login.uris).toHaveLength(1);
        expect(mockCipher.login.uris[0].uri).toBe(mockCurrentTab.url);
        expect(mockCipherService.encrypt).toHaveBeenCalledWith(mockCipher, mockUserId);
        expect(mockCipherService.updateWithServer).toHaveBeenCalledWith(mockEncryptedCipher);
      });

      it("should add a URI to the cipher when there are no existing URIs", async () => {
        mockCipher.login.uris = null;
        const result = await service.doAutofillAndSave(mockCipher);
        expect(result).toBe(true);
        expect(mockCipher.login.uris).toHaveLength(1);
        expect(mockCipher.login.uris[0].uri).toBe(mockCurrentTab.url);
      });

      it("should show an error toast if saving the cipher fails", async () => {
        mockCipherService.updateWithServer.mockRejectedValue(null);
        const result = await service.doAutofillAndSave(mockCipher);
        expect(result).toBe(false);
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: null,
          message: mockI18nService.t("unexpectedError"),
        });
      });

      it("should close the popup after saving the cipher", async () => {
        const result = await service.doAutofillAndSave(mockCipher);
        expect(result).toBe(true);
        expect(BrowserApi.closePopup).toHaveBeenCalled();
      });

      it("should show success toast after saving the cipher if closePop is false", async () => {
        mockAutofillService.doAutoFill.mockResolvedValue(null);
        const result = await service.doAutofillAndSave(mockCipher, false);
        expect(result).toBe(true);
        expect(BrowserApi.closePopup).not.toHaveBeenCalled();
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          title: null,
          message: mockI18nService.t("autoFillSuccessAndSavedUri"),
        });
      });
    });
  });
});
