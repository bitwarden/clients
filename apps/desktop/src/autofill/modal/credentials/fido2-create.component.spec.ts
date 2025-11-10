import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
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

  const activeAccountSubject = new BehaviorSubject<Account | null>({
    id: "test-user-id" as UserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  });

  beforeEach(async () => {
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
    mockAccountService.activeAccount$ = activeAccountSubject;

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

    return [cipher1];
  }

  describe("ngOnInit", () => {
    beforeEach(() => {
      mockSession.getRpId.mockResolvedValue("example.com");
      Object.defineProperty(mockDesktopAutofillService, "lastRegistrationRequest", {
        get: jest.fn().mockReturnValue({
          userHandle: new Uint8Array([1, 2, 3]),
        }),
        configurable: true,
      });
      mockDomainSettingsService.getUrlEquivalentDomains.mockReturnValue(of(new Set<string>()));
    });

    it("should initialize session and set show header to false", async () => {
      const mockCiphers = createMockCiphers();
      mockCipherService.getAllDecrypted.mockResolvedValue(mockCiphers);

      await component.ngOnInit();

      expect(mockFido2UserInterfaceService.getCurrentSession).toHaveBeenCalled();
      expect(component.session).toBe(mockSession);
    });

    it("should show error dialog when no active session found", async () => {
      mockFido2UserInterfaceService.getCurrentSession.mockReturnValue(null);
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      await component.ngOnInit();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "unableToSavePasskey" },
        content: { key: "closeThisBitwardenWindow" },
        type: "danger",
        acceptButtonText: { key: "closeThisWindow" },
        acceptAction: expect.any(Function),
        cancelButtonText: null,
      });
    });
  });

  describe("addCredentialToCipher", () => {
    beforeEach(() => {
      component.session = mockSession;
    });

    it("should add passkey to cipher", async () => {
      const cipher = createMockCiphers()[0];

      await component.addCredentialToCipher(cipher);

      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(true, cipher);
    });

    it("should not add passkey when password reprompt is cancelled", async () => {
      const cipher = createMockCiphers()[0];
      cipher.reprompt = CipherRepromptType.Password;
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await component.addCredentialToCipher(cipher);

      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(false, cipher);
    });

    it("should call openSimpleDialog when cipher already has a fido2 credential", async () => {
      const cipher = createMockCiphers()[0];
      Object.defineProperty(cipher.login, "hasFido2Credentials", {
        get: jest.fn().mockReturnValue(true),
      });
      mockDialogService.openSimpleDialog.mockResolvedValue(true);

      await component.addCredentialToCipher(cipher);

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "overwritePasskey" },
        content: { key: "alreadyContainsPasskey" },
        type: "warning",
      });
      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(true, cipher);
    });

    it("should not add passkey when user cancels overwrite dialog", async () => {
      const cipher = createMockCiphers()[0];
      Object.defineProperty(cipher.login, "hasFido2Credentials", {
        get: jest.fn().mockReturnValue(true),
      });
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      await component.addCredentialToCipher(cipher);

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
    });

    it("should call openSimpleDialog when session is null", async () => {
      component.session = null;
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      await component.confirmPasskey();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "unableToSavePasskey" },
        content: { key: "closeThisBitwardenWindow" },
        type: "danger",
        acceptButtonText: { key: "closeThisWindow" },
        acceptAction: expect.any(Function),
        cancelButtonText: null,
      });
    });
  });

  describe("closeModal", () => {
    it("should close modal and notify session", async () => {
      component.session = mockSession;

      await component.closeModal();

      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(false);
      expect(mockSession.confirmChosenCipher).toHaveBeenCalledWith(null);
    });
  });
});
