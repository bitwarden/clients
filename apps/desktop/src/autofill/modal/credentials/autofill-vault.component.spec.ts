import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import {
  DesktopAutofillUiService,
  DesktopAutofillUiSession,
} from "../../services/desktop-autofill-ui.service";

import { AutofillVaultComponent, AutofillVaultRouteData } from "./autofill-vault.component";

describe("AutofillVaultComponent", () => {
  let component: AutofillVaultComponent;
  let fixture: ComponentFixture<AutofillVaultComponent>;
  let mockDesktopSettingsService: MockProxy<DesktopSettingsService>;
  let mockAutofillUiService: MockProxy<DesktopAutofillUiService>;
  let mockCipherService: MockProxy<CipherService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockLogService: MockProxy<LogService>;
  let mockRouter: MockProxy<Router>;
  let mockSession: MockProxy<DesktopAutofillUiSession>;
  let mockI18nService: MockProxy<I18nService>;
  let routeData: AutofillVaultRouteData;

  const mockActiveAccount = { id: "test-user-id", email: "test@example.com" };
  const mockCipherIds = ["cipher-1", "cipher-2", "cipher-3"];

  beforeEach(async () => {
    mockDesktopSettingsService = mock<DesktopSettingsService>();
    mockAutofillUiService = mock<DesktopAutofillUiService>();
    mockCipherService = mock<CipherService>();
    mockAccountService = mock<AccountService>();
    mockLogService = mock<LogService>();
    mockRouter = mock<Router>();
    mockSession = mock<DesktopAutofillUiSession>();
    mockI18nService = mock<I18nService>();
    routeData = { titleKey: "passkeyLogin2", headingKey: "chooseCipherForPasskeyAuth" };

    mockAccountService.activeAccount$ = of(mockActiveAccount as Account);
    mockAutofillUiService.getCurrentSession.mockReturnValue(mockSession);
    mockSession.availableCipherIds$ = of(mockCipherIds);
    mockCipherService.cipherListViews$ = jest.fn().mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AutofillVaultComponent],
      providers: [
        { provide: DesktopSettingsService, useValue: mockDesktopSettingsService },
        { provide: DesktopAutofillUiService, useValue: mockAutofillUiService },
        { provide: CipherService, useValue: mockCipherService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: LogService, useValue: mockLogService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: ConfigService,
          useValue: mock<ConfigService>({ getFeatureFlag$: () => of(false) }),
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get data() {
                return routeData;
              },
            },
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideProvider(DialogService, { useValue: mock<DialogService>() })
      .compileComponents();

    createComponent();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(AutofillVaultComponent);
    component = fixture.componentInstance;
  }

  const mockCiphers: any[] = [
    {
      id: "cipher-1",
      name: "Test Cipher 1",
      type: CipherType.Login,
      login: {
        username: "test1@example.com",
      },
      reprompt: CipherRepromptType.None,
      deletedDate: null,
    },
    {
      id: "cipher-2",
      name: "Test Cipher 2",
      type: CipherType.Login,
      login: {
        username: "test2@example.com",
      },
      reprompt: CipherRepromptType.None,
      deletedDate: null,
    },
    {
      id: "cipher-3",
      name: "Test Cipher 3",
      type: CipherType.Login,
      login: {
        username: "test3@example.com",
      },
      reprompt: CipherRepromptType.Password,
      deletedDate: null,
    },
  ];

  describe("ciphers$", () => {
    it("loads ciphers for the active account", () => {
      mockCipherService.cipherListViews$ = jest.fn().mockReturnValue(of(mockCiphers));
      createComponent();

      let ciphersResult: CipherView[] = [];
      component.ciphers$.subscribe((ciphers) => (ciphersResult = ciphers));

      expect(mockAutofillUiService.getCurrentSession).toHaveBeenCalled();
      expect(component.session).toBe(mockSession);
      expect(mockCipherService.cipherListViews$).toHaveBeenCalledWith(mockActiveAccount.id);
      expect(ciphersResult).toHaveLength(3);
    });

    it("filters out deleted ciphers", () => {
      const ciphersWithDeleted = [
        ...mockCiphers.slice(0, 1),
        { ...mockCiphers[1], deletedDate: new Date() },
        ...mockCiphers.slice(2),
      ];
      mockCipherService.cipherListViews$ = jest.fn().mockReturnValue(of(ciphersWithDeleted));
      createComponent();

      let ciphersResult: CipherView[] = [];
      component.ciphers$.subscribe((ciphers) => (ciphersResult = ciphers));

      expect(ciphersResult).toHaveLength(2);
      expect(ciphersResult.every((cipher) => !cipher.deletedDate)).toBe(true);
    });

    it("keeps only the ciphers the session offered", () => {
      mockSession.availableCipherIds$ = of(["cipher-2"]);
      mockCipherService.cipherListViews$ = jest.fn().mockReturnValue(of(mockCiphers));
      createComponent();

      let ciphersResult: CipherView[] = [];
      component.ciphers$.subscribe((ciphers) => (ciphersResult = ciphers));

      expect(ciphersResult.map((cipher) => cipher.id)).toEqual(["cipher-2"]);
    });
  });

  describe("routeData", () => {
    it("comes from the route, so each autofill flow names itself", () => {
      routeData = { titleKey: "autofillVerificationCode" };
      createComponent();

      expect(component.routeData).toEqual({ titleKey: "autofillVerificationCode" });
    });
  });

  describe("session", () => {
    it("is undefined when no active session found", () => {
      mockAutofillUiService.getCurrentSession.mockReturnValue(undefined);
      createComponent();

      expect(component.session).toBeUndefined();
    });
  });

  describe("chooseCipher", () => {
    const cipher = mockCiphers[0];

    it("hands the chosen cipher to the session", async () => {
      await component.chooseCipher(cipher);

      // Verification (master-password reprompt or OS) is handled by the session.
      expect(mockSession.confirmChosenCipher).toHaveBeenCalledWith(cipher);
    });

    it("closes the modal if the session is not found when cipher is chosen ", async () => {
      mockAutofillUiService.getCurrentSession.mockReturnValue(undefined);
      createComponent();

      await component.chooseCipher(cipher);

      // Verification (master-password reprompt or OS) is handled by the session.
      expect(mockSession.confirmChosenCipher).not.toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
    });
  });

  describe("closeModal", () => {
    it("should close modal and notify session", async () => {
      await component.closeModal();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockSession.cancel).toHaveBeenCalled();
    });
  });
});
