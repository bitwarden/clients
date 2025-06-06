import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { DesktopAutofillService } from "../../../autofill/services/desktop-autofill.service";
import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import {
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
} from "../../services/desktop-fido2-user-interface.service";

import { Fido2CreateComponent } from "./fido2-create.component";

describe("Fido2CreateComponent", () => {
  let component: Fido2CreateComponent;
  let mockDesktopSettingsService: MockProxy<DesktopSettingsService>;
  let mockFido2UserInterfaceService: MockProxy<DesktopFido2UserInterfaceService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockCipherService: MockProxy<CipherService>;
  let mockDesktopAutofillService: MockProxy<DesktopAutofillService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockDomainSettingsService: MockProxy<DomainSettingsService>;
  let mockLogService: MockProxy<LogService>;
  let mockPasswordRepromptService: MockProxy<PasswordRepromptService>;
  let mockRouter: MockProxy<Router>;
  let mockSession: MockProxy<DesktopFido2UserInterfaceSession>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    // Create mocks
    mockDesktopSettingsService = mock<DesktopSettingsService>();
    mockFido2UserInterfaceService = mock<DesktopFido2UserInterfaceService>();
    mockAccountService = mock<AccountService>();
    mockCipherService = mock<CipherService>();
    mockDesktopAutofillService = mock<DesktopAutofillService>();
    mockDialogService = mock<DialogService>();
    mockDomainSettingsService = mock<DomainSettingsService>();
    mockLogService = mock<LogService>();
    mockPasswordRepromptService = mock<PasswordRepromptService>();
    mockRouter = mock<Router>();
    mockSession = mock<DesktopFido2UserInterfaceSession>();
    mockI18nService = mock<I18nService>();

    mockFido2UserInterfaceService.getCurrentSession.mockReturnValue(mockSession);
    mockAccountService.activeAccount$ = of({ id: "test-user-id", email: "test@example.com" });

    await TestBed.configureTestingModule({
      providers: [
        Fido2CreateComponent,
        { provide: DesktopSettingsService, useValue: mockDesktopSettingsService },
        { provide: DesktopFido2UserInterfaceService, useValue: mockFido2UserInterfaceService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: CipherService, useValue: mockCipherService },
        { provide: DesktopAutofillService, useValue: mockDesktopAutofillService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: DomainSettingsService, useValue: mockDomainSettingsService },
        { provide: LogService, useValue: mockLogService },
        { provide: PasswordRepromptService, useValue: mockPasswordRepromptService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    component = TestBed.inject(Fido2CreateComponent);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper function to create mock ciphers
  function createMockCiphers(): CipherView[] {
    const cipher1 = new CipherView();
    cipher1.id = "cipher-1";
    cipher1.name = "Test Cipher 1";
    cipher1.type = CipherType.Login;
    cipher1.login = {
      username: "test1@example.com",
      uris: [{ uri: "https://example.com", match: null }],
      matchesUri: jest.fn().mockReturnValue(true),
      get hasFido2Credentials() {
        return false;
      },
    } as any;
    cipher1.reprompt = CipherRepromptType.None;
    cipher1.deletedDate = null;

    const cipher2 = new CipherView();
    cipher2.id = "cipher-2";
    cipher2.name = "Test Cipher 2";
    cipher2.type = CipherType.Login;
    cipher2.login = {
      username: "test2@example.com",
      uris: [{ uri: "https://example.com", match: null }],
      matchesUri: jest.fn().mockReturnValue(true),
      get hasFido2Credentials() {
        return false;
      },
    } as any;
    cipher2.reprompt = CipherRepromptType.None;
    cipher2.deletedDate = null;

    const cipher3 = new CipherView();
    cipher3.id = "cipher-3";
    cipher3.name = "Test Cipher 3";
    cipher3.type = CipherType.Login;
    cipher3.login = {
      username: "test3@example.com",
      uris: [{ uri: "https://different.com", match: null }],
      matchesUri: jest.fn().mockReturnValue(false),
      get hasFido2Credentials() {
        return false;
      },
    } as any;
    cipher3.reprompt = CipherRepromptType.Password;
    cipher3.deletedDate = null;

    return [cipher1, cipher2, cipher3];
  }

  describe("ngOnInit", () => {
    beforeEach(() => {
      // Setup default mocks for successful case
      mockSession.getRpId.mockResolvedValue("example.com");
      mockDesktopAutofillService.lastRegistrationRequest = {
        userHandle: new Uint8Array([1, 2, 3]),
      };
      mockDomainSettingsService.getUrlEquivalentDomains.mockReturnValue(of([]));
    });

    it("should initialize session and set show header to false", async () => {
      const mockCiphers = createMockCiphers();
      mockCipherService.getAllDecrypted.mockResolvedValue(mockCiphers);

      await component.ngOnInit();

      expect(mockAccountService.setShowHeader).toHaveBeenCalledWith(false);
      expect(mockFido2UserInterfaceService.getCurrentSession).toHaveBeenCalled();
      expect(component.session).toBe(mockSession);
    });

    it("should throw error when no active session found", async () => {
      mockFido2UserInterfaceService.getCurrentSession.mockReturnValue(null);

      await expect(component.ngOnInit()).rejects.toThrow(
        "Cannot read properties of null (reading 'getRpId')",
      );
    });

    it("should handle missing rpId", async () => {
      mockSession.getRpId.mockResolvedValue(null);
      const mockCiphers = createMockCiphers();
      mockCipherService.getAllDecrypted.mockResolvedValue(mockCiphers);
      mockDomainSettingsService.getUrlEquivalentDomains.mockReturnValue(of(null));

      await component.ngOnInit();

      // Component should initialize
      expect(component.session).toBe(mockSession);
    });

    it("should handle missing active user", async () => {
      mockAccountService.activeAccount$ = of(null);
      const mockCiphers = createMockCiphers();
      mockCipherService.getAllDecrypted.mockResolvedValue(mockCiphers);

      await component.ngOnInit();

      // Component should initialize
      expect(component.session).toBe(mockSession);
    });

    it("should handle missing registration request", async () => {
      mockDesktopAutofillService.lastRegistrationRequest = null;
      const mockCiphers = createMockCiphers();
      mockCipherService.getAllDecrypted.mockResolvedValue(mockCiphers);

      await component.ngOnInit();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      // The error will be caught and logged
      expect(mockLogService.error).toHaveBeenCalled();
    });
  });

  describe("ngOnDestroy", () => {
    it("should restore header visibility", async () => {
      await component.ngOnDestroy();

      expect(mockAccountService.setShowHeader).toHaveBeenCalledWith(true);
    });
  });

  describe("addPasskeyToCipher", () => {
    beforeEach(() => {
      component.session = mockSession;
    });

    it("should add passkey to cipher when access is validated", async () => {
      const cipher = createMockCiphers()[0];
      cipher.reprompt = CipherRepromptType.None;

      await component.addPasskeyToCipher(cipher);

      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(true, cipher);
    });

    it("should not add passkey when password reprompt is cancelled", async () => {
      const cipher = createMockCiphers()[0];
      cipher.reprompt = CipherRepromptType.Password;
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await component.addPasskeyToCipher(cipher);

      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(false, cipher);
    });
  });

  describe("confirmPasskey", () => {
    beforeEach(() => {
      component.session = mockSession;
    });

    it("should confirm passkey creation successfully", async () => {
      await component.confirmPasskey();

      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(true);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
      expect(mockDesktopSettingsService.setModalMode).toHaveBeenCalledWith(false);
    });
  });

  describe("closeModal", () => {
    it("should close modal and notify session", async () => {
      component.session = mockSession;

      await component.closeModal();

      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
      expect(mockDesktopSettingsService.setModalMode).toHaveBeenCalledWith(false);
      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(false);
      expect(mockSession.confirmChosenCipher).toHaveBeenCalledWith(null);
    });

    it("should handle missing session with error", async () => {
      component.session = null;

      // closeModal() tries to call methods on session without null check
      await expect(component.closeModal()).rejects.toThrow();
    });
  });
});
