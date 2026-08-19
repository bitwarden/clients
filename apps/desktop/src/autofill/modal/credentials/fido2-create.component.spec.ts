import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

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
  let mockDialogService: MockProxy<DialogService>;
  let mockLogService: MockProxy<LogService>;
  let mockRouter: MockProxy<Router>;
  let mockSession: MockProxy<DesktopFido2UserInterfaceSession>;
  let mockI18nService: MockProxy<I18nService>;

  const activeAccountSubject = new BehaviorSubject<Account | null>({
    id: "test-user-id" as UserId,
    ...mockAccountInfoWith({
      email: "test@example.com",
      name: "Test User",
    }),
  });

  beforeEach(async () => {
    mockDesktopSettingsService = mock<DesktopSettingsService>();
    mockFido2UserInterfaceService = mock<DesktopFido2UserInterfaceService>();
    mockAccountService = mock<AccountService>();
    mockDialogService = mock<DialogService>();
    mockLogService = mock<LogService>();
    mockRouter = mock<Router>();
    mockSession = mock<DesktopFido2UserInterfaceSession>();
    mockI18nService = mock<I18nService>();

    mockFido2UserInterfaceService.getCurrentSession.mockReturnValue(mockSession);
    mockAccountService.activeAccount$ = activeAccountSubject;

    // The component reads its cipher list from the session, which is the single
    // source of truth for the logins the new passkey could be added to.
    mockSession.getMatchingLogins.mockResolvedValue([]);

    await TestBed.configureTestingModule({
      providers: [
        { provide: DesktopSettingsService, useValue: mockDesktopSettingsService },
        { provide: DesktopFido2UserInterfaceService, useValue: mockFido2UserInterfaceService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: LogService, useValue: mockLogService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    component = createComponent();
  });

  function createComponent(): Fido2CreateComponent {
    return TestBed.runInInjectionContext(() => new Fido2CreateComponent());
  }

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
    it("uses the current session", () => {
      expect(mockFido2UserInterfaceService.getCurrentSession).toHaveBeenCalled();
      expect(component.session).toBe(mockSession);
    });

    it("should show error dialog when no active session found", async () => {
      mockFido2UserInterfaceService.getCurrentSession.mockReturnValue(undefined);
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      const componentWithoutSession = createComponent();
      await componentWithoutSession.ngOnInit();

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
    it("should add passkey to cipher", async () => {
      const cipher = createMockCiphers()[0];

      await component.addCredentialToCipher(cipher);

      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(true, cipher);
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
    it("should confirm passkey creation successfully", async () => {
      await component.confirmPasskey();

      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(true);
    });

    it("should call openSimpleDialog when session is null", async () => {
      mockFido2UserInterfaceService.getCurrentSession.mockReturnValue(undefined);
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      const componentWithoutSession = createComponent();
      await componentWithoutSession.confirmPasskey();

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
      await component.closeModal();

      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(false);
      expect(mockSession.confirmChosenCipher).toHaveBeenCalledWith(undefined);
    });
  });
});
