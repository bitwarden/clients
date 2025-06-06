import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { PasswordRepromptService } from "@bitwarden/vault";

import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import {
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
} from "../../services/desktop-fido2-user-interface.service";

import { Fido2VaultComponent } from "./fido2-vault.component";

describe("Fido2VaultComponent", () => {
  let component: Fido2VaultComponent;
  let fixture: ComponentFixture<Fido2VaultComponent>;
  let mockDesktopSettingsService: MockProxy<DesktopSettingsService>;
  let mockFido2UserInterfaceService: MockProxy<DesktopFido2UserInterfaceService>;
  let mockCipherService: MockProxy<CipherService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockLogService: MockProxy<LogService>;
  let mockPasswordRepromptService: MockProxy<PasswordRepromptService>;
  let mockRouter: MockProxy<Router>;
  let mockSession: MockProxy<DesktopFido2UserInterfaceSession>;
  let mockI18nService: MockProxy<I18nService>;

  const mockActiveAccount = { id: "test-user-id", email: "test@example.com" };
  const mockCipherIds = ["cipher-1", "cipher-2", "cipher-3"];

  beforeEach(async () => {
    mockDesktopSettingsService = mock<DesktopSettingsService>();
    mockFido2UserInterfaceService = mock<DesktopFido2UserInterfaceService>();
    mockCipherService = mock<CipherService>();
    mockAccountService = mock<AccountService>();
    mockLogService = mock<LogService>();
    mockPasswordRepromptService = mock<PasswordRepromptService>();
    mockRouter = mock<Router>();
    mockSession = mock<DesktopFido2UserInterfaceSession>();
    mockI18nService = mock<I18nService>();

    mockAccountService.activeAccount$ = of(mockActiveAccount as Account);
    mockFido2UserInterfaceService.getCurrentSession.mockReturnValue(mockSession);
    mockSession.availableCipherIds$ = of(mockCipherIds);
    mockCipherService.getAllDecryptedForIds.mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [Fido2VaultComponent],
      providers: [
        { provide: DesktopSettingsService, useValue: mockDesktopSettingsService },
        { provide: DesktopFido2UserInterfaceService, useValue: mockFido2UserInterfaceService },
        { provide: CipherService, useValue: mockCipherService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: LogService, useValue: mockLogService },
        { provide: PasswordRepromptService, useValue: mockPasswordRepromptService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Fido2VaultComponent);
    component = fixture.componentInstance;
  });

  function createMockCiphers(): CipherView[] {
    const cipher1 = new CipherView();
    cipher1.id = "cipher-1";
    cipher1.name = "Test Cipher 1";
    cipher1.type = CipherType.Login;
    cipher1.login = new LoginView();
    cipher1.login.username = "test1@example.com";
    cipher1.reprompt = CipherRepromptType.None;
    cipher1.deletedDate = null;

    const cipher2 = new CipherView();
    cipher2.id = "cipher-2";
    cipher2.name = "Test Cipher 2";
    cipher2.type = CipherType.Login;
    cipher2.login = new LoginView();
    cipher2.login.username = "test2@example.com";
    cipher2.reprompt = CipherRepromptType.None;
    cipher2.deletedDate = null;

    const cipher3 = new CipherView();
    cipher3.id = "cipher-3";
    cipher3.name = "Test Cipher 3";
    cipher3.type = CipherType.Login;
    cipher3.login = new LoginView();
    cipher3.login.username = "test3@example.com";
    cipher3.reprompt = CipherRepromptType.Password;
    cipher3.deletedDate = null;

    return [cipher1, cipher2, cipher3];
  }

  describe("ngOnInit", () => {
    it("should initialize session and load ciphers successfully", async () => {
      const mockCiphers = createMockCiphers();
      mockCipherService.getAllDecryptedForIds.mockResolvedValue(mockCiphers);

      await component.ngOnInit();

      expect(mockAccountService.setShowHeader).toHaveBeenCalledWith(false);
      expect(mockFido2UserInterfaceService.getCurrentSession).toHaveBeenCalled();
      expect(component.session).toBe(mockSession);
      expect(component.cipherIds$).toBe(mockSession.availableCipherIds$);
    });

    it("should handle error when no active session found", async () => {
      mockFido2UserInterfaceService.getCurrentSession.mockReturnValue(null);

      await expect(component.ngOnInit()).rejects.toThrow();
    });

    it("should filter out deleted ciphers", async () => {
      const mockCiphers = createMockCiphers();
      mockCiphers[1].deletedDate = new Date();
      mockCipherService.getAllDecryptedForIds.mockResolvedValue(mockCiphers);

      await component.ngOnInit();
      await new Promise((resolve) => setTimeout(resolve, 0));

      let ciphersResult: CipherView[] = [];
      component.ciphers$.subscribe((ciphers) => {
        ciphersResult = ciphers;
      });

      expect(ciphersResult).toHaveLength(2);
      expect(ciphersResult.every((cipher) => !cipher.deletedDate)).toBe(true);
    });
  });

  describe("ngOnDestroy", () => {
    it("should restore header visibility and clean up", async () => {
      await component.ngOnInit();
      await component.ngOnDestroy();

      expect(mockAccountService.setShowHeader).toHaveBeenCalledWith(true);
    });
  });

  describe("chooseCipher", () => {
    beforeEach(() => {
      component.session = mockSession;
    });

    it("should choose cipher when access is validated", async () => {
      const cipher = createMockCiphers()[0];
      cipher.reprompt = CipherRepromptType.None;

      await component.chooseCipher(cipher);

      expect(mockSession.confirmChosenCipher).toHaveBeenCalledWith(cipher.id, true);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
      expect(mockDesktopSettingsService.setModalMode).toHaveBeenCalledWith(false);
    });

    it("should prompt for password when cipher requires reprompt", async () => {
      const cipher = createMockCiphers()[0];
      cipher.reprompt = CipherRepromptType.Password;
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(true);

      await component.chooseCipher(cipher);

      expect(mockPasswordRepromptService.showPasswordPrompt).toHaveBeenCalled();
      expect(mockSession.confirmChosenCipher).toHaveBeenCalledWith(cipher.id, true);
    });

    it("should not choose cipher when password reprompt is cancelled", async () => {
      const cipher = createMockCiphers()[0];
      cipher.reprompt = CipherRepromptType.Password;
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await component.chooseCipher(cipher);

      expect(mockPasswordRepromptService.showPasswordPrompt).toHaveBeenCalled();
      expect(mockSession.confirmChosenCipher).toHaveBeenCalledWith(cipher.id, false);
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
  });
});
