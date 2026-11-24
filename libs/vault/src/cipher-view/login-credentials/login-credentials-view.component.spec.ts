import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, delay, of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PremiumUpgradeNudgeService } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { RiskCategory } from "@bitwarden/common/dirt/vault-health/models";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  BitFormFieldComponent,
  BitPasswordInputToggleDirective,
  ColorPasswordComponent,
  CopyClickDirective,
  ToastService,
} from "@bitwarden/components";

import { LoginCredentialsViewComponent } from "./login-credentials-view.component";

describe("LoginCredentialsViewComponent", () => {
  let component: LoginCredentialsViewComponent;
  let fixture: ComponentFixture<LoginCredentialsViewComponent>;

  const hasPremiumFromAnySource$ = new BehaviorSubject<boolean>(true);
  const mockAccount = {
    id: "test-user-id" as UserId,
    ...mockAccountInfoWith({
      email: "test@example.com",
      name: "Test User",
    }),
    type: 0,
    status: 0,
    kdf: 0,
    kdfIterations: 0,
  };

  const cipher = {
    id: "cipher-id",
    name: "Mock Cipher",
    type: CipherType.Login,
    login: new LoginView(),
  } as CipherView;

  cipher.login.password = "cipher-password";
  cipher.login.username = "cipher-username";
  const date = new Date("2024-02-02");
  cipher.login.fido2Credentials = [{ creationDate: date } as Fido2CredentialView];

  const collect = jest.fn();
  let upgradePathsFlag$: BehaviorSubject<boolean>;
  let showTotpNudge$: BehaviorSubject<boolean>;
  let configService: MockProxy<ConfigService>;
  let nudgesService: MockProxy<NudgesService>;
  let premiumUpgradeNudgeService: MockProxy<PremiumUpgradeNudgeService>;
  let premiumUpgradePromptService: MockProxy<PremiumUpgradePromptService>;

  beforeEach(async () => {
    collect.mockClear();
    upgradePathsFlag$ = new BehaviorSubject<boolean>(false);
    showTotpNudge$ = new BehaviorSubject<boolean>(true);
    configService = mock<ConfigService>();
    nudgesService = mock<NudgesService>();
    premiumUpgradeNudgeService = mock<PremiumUpgradeNudgeService>();
    premiumUpgradePromptService = mock<PremiumUpgradePromptService>();
    configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
      flag === FeatureFlag.PM42214_FeatureBasedUpgradePaths ? upgradePathsFlag$ : of(false),
    );
    nudgesService.showNudgeSpotlight$.mockReturnValue(showTotpNudge$);
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = new BehaviorSubject(mockAccount);

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>({
            hasPremiumFromAnySource$: () => hasPremiumFromAnySource$,
          }),
        },
        { provide: AccountService, useValue: accountService },
        { provide: PremiumUpgradePromptService, useValue: premiumUpgradePromptService },
        { provide: EventCollectionService, useValue: mock<EventCollectionService>({ collect }) },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: (...keys: string[]) => keys.join(" ") } },
        { provide: ConfigService, useValue: configService },
        { provide: NudgesService, useValue: nudgesService },
        { provide: PremiumUpgradeNudgeService, useValue: premiumUpgradeNudgeService },
        {
          provide: TotpService,
          useValue: mock<TotpService>({
            getCode$: () => of({ code: "123456", period: 30 }).pipe(delay(0)),
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginCredentialsViewComponent);
    component = fixture.componentInstance;
    component.cipher = cipher;
    fixture.detectChanges();
  });

  describe("username", () => {
    let usernameField: DebugElement;

    beforeEach(() => {
      usernameField = fixture.debugElement.queryAll(By.directive(BitFormFieldComponent))[0];
    });

    it("displays the username", () => {
      const usernameInput = usernameField.query(By.css("input")).nativeElement;

      expect(usernameInput.value).toBe(cipher.login.username);
    });

    it("configures CopyClickDirective for the username", () => {
      const usernameCopyButton = usernameField.query(By.directive(CopyClickDirective));
      const usernameCopyClickDirective = usernameCopyButton.injector.get(CopyClickDirective);

      expect(usernameCopyClickDirective.valueToCopy()).toBe(cipher.login.username);
    });
  });

  describe("password", () => {
    let passwordField: DebugElement;

    beforeEach(() => {
      passwordField = fixture.debugElement.queryAll(By.directive(BitFormFieldComponent))[1];
    });

    it("displays a masked password by default", () => {
      const passwordInput = passwordField.query(By.css("input")).nativeElement;

      expect(passwordInput.value).toBe(cipher.login.maskedPassword);
    });

    it("displays the actual password when revealed", () => {
      cipher.viewPassword = true;
      fixture.detectChanges();

      const viewPasswordButton = passwordField.query(By.directive(BitPasswordInputToggleDirective));
      const toggleInputDirective = viewPasswordButton.injector.get(BitPasswordInputToggleDirective);

      toggleInputDirective.onClick();
      fixture.detectChanges();

      const passwordInput = passwordField.query(By.css("input")).nativeElement;

      expect(passwordInput.value).toBe(cipher.login.password);
    });

    describe("at-risk badge", () => {
      const query = (testId: string) =>
        fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));

      const render = (category: RiskCategory | null, link?: string) => {
        component.showChangePasswordLink = true;
        fixture.componentRef.setInput("passwordRiskCategory", category);
        fixture.componentRef.setInput("changePasswordLink", link);
        fixture.detectChanges();
      };

      it.each([
        [RiskCategory.Exposed, "exposed"],
        [RiskCategory.Weak, "weak"],
        [RiskCategory.Reused, "reused"],
      ])("shows the %s badge", (category, label) => {
        render(category);

        expect(query("password-risk-badge").nativeElement.textContent.trim()).toBe(label);
      });

      it("shows the generic at-risk badge when there is no risk category", () => {
        render(null, "https://example.com/change");

        expect(query("password-risk-badge").nativeElement.textContent.trim()).toBe(
          "passwordAtRisk",
        );
        expect(query("change-password-link").nativeElement.getAttribute("href")).toBe(
          "https://example.com/change",
        );
      });

      it("hides the badge when the change password link is not shown", () => {
        fixture.componentRef.setInput("passwordRiskCategory", RiskCategory.Weak);
        fixture.detectChanges();

        expect(query("password-risk-badge")).toBeNull();
      });
    });

    describe("copy", () => {
      it("does not allow copy when `viewPassword` is false", () => {
        cipher.viewPassword = false;
        fixture.detectChanges();

        const passwordCopyButton = passwordField.query(By.directive(CopyClickDirective));

        expect(passwordCopyButton).toBeNull();
      });

      it("configures CopyClickDirective for the password", () => {
        cipher.viewPassword = true;
        fixture.detectChanges();

        const passwordCopyButton = passwordField.query(By.directive(CopyClickDirective));
        const passwordCopyClickDirective = passwordCopyButton.injector.get(CopyClickDirective);

        expect(passwordCopyClickDirective.valueToCopy()).toBe(cipher.login.password);
      });
    });

    describe("toggle password", () => {
      it("does not allow password to be viewed when `viewPassword` is false", () => {
        cipher.viewPassword = false;
        fixture.detectChanges();

        const viewPasswordButton = passwordField.query(
          By.directive(BitPasswordInputToggleDirective),
        );

        expect(viewPasswordButton).toBeNull();
      });

      it("shows password color component", () => {
        cipher.viewPassword = true;
        fixture.detectChanges();

        const viewPasswordButton = passwordField.query(
          By.directive(BitPasswordInputToggleDirective),
        );
        const toggleInputDirective = viewPasswordButton.injector.get(
          BitPasswordInputToggleDirective,
        );

        toggleInputDirective.onClick();
        fixture.detectChanges();

        const passwordColor = passwordField.query(By.directive(ColorPasswordComponent));

        expect(passwordColor.componentInstance.password()).toBe(cipher.login.password);
      });

      it("records event", () => {
        cipher.viewPassword = true;
        fixture.detectChanges();

        const viewPasswordButton = passwordField.query(
          By.directive(BitPasswordInputToggleDirective),
        );
        const toggleInputDirective = viewPasswordButton.injector.get(
          BitPasswordInputToggleDirective,
        );

        toggleInputDirective.onClick();
        fixture.detectChanges();

        expect(collect).toHaveBeenCalledWith(
          EventType.Cipher_ClientToggledPasswordVisible,
          cipher.id,
          false,
          cipher.organizationId,
        );
      });
    });
  });

  describe("fido2Credentials", () => {
    let fido2Field: DebugElement;

    beforeEach(() => {
      fido2Field = fixture.debugElement.queryAll(By.directive(BitFormFieldComponent))[2];

      // Mock datePipe to avoid timezone related issues within tests
      jest.spyOn(component["datePipe"], "transform").mockReturnValue("2/2/24 6:00PM");
      fixture.detectChanges();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("displays the creation date", () => {
      const fido2Input = fido2Field.query(By.css("input")).nativeElement;

      expect(fido2Input.value).toBe("dateCreated 2/2/24 6:00PM");
    });
  });
  describe("verification code", () => {
    const userId = "test-user-id" as UserId;
    const query = (testId: string) =>
      fixture.nativeElement.querySelector(`[data-testid='${testId}']`);

    const totpCipher = (organizationId?: string) => {
      const login = Object.assign(new LoginView(), {
        username: "cipher-username",
        totp: "JBSWY3DPEHPK3PXP",
      });
      return Object.assign(new CipherView(), {
        id: "totp-cipher-id",
        type: CipherType.Login,
        login,
        organizationId,
      });
    };

    const render = ({
      organizationId,
      allow = true,
      activeUserId = userId,
    }: { organizationId?: string; allow?: boolean; activeUserId?: UserId | null } = {}) => {
      fixture.componentRef.setInput("cipher", totpCipher(organizationId));
      fixture.componentRef.setInput("activeUserId", activeUserId);
      fixture.componentRef.setInput("allowPremiumUpgradeCallout", allow);
      fixture.detectChanges();
    };

    beforeEach(() => {
      hasPremiumFromAnySource$.next(false);
      upgradePathsFlag$.next(true);
    });

    afterEach(() => {
      hasPremiumFromAnySource$.next(true);
    });

    describe("section", () => {
      it("shows a masked authenticator key without exposing the key when the flag is on", () => {
        render();

        expect(query("verification-code-section")).not.toBeNull();
        const key = query("login-authenticator-key");
        expect(key.value).not.toContain("JBSWY3DPEHPK3PXP");
        expect(fixture.nativeElement.innerHTML).not.toContain("JBSWY3DPEHPK3PXP");
      });

      it("shows the TOTP code only once, inside the section, for a Premium user", () => {
        hasPremiumFromAnySource$.next(true);
        render();

        expect(fixture.nativeElement.querySelectorAll("[data-testid='login-totp']").length).toBe(1);
        expect(
          query("verification-code-section").querySelector("[data-testid='login-totp']"),
        ).not.toBeNull();
        expect(query("verification-code-section").textContent).toContain("totpCode");
        expect(query("verification-code-section").textContent).not.toContain(
          "verificationCodeTotp",
        );
      });

      it("does not show the TOTP code to a free user on a personal item", () => {
        render();

        expect(query("login-totp")).toBeNull();
      });

      it("hides the login credentials section when the login has only an authenticator key", () => {
        const cipher = totpCipher();
        cipher.login.username = undefined;
        fixture.componentRef.setInput("cipher", cipher);
        fixture.componentRef.setInput("activeUserId", userId);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).not.toContain("loginCredentials");
        expect(query("verification-code-section")).not.toBeNull();
      });

      it("keeps today's layout when the flag is off", () => {
        upgradePathsFlag$.next(false);
        render();

        expect(query("verification-code-section")).toBeNull();
        expect(query("login-authenticator-key")).toBeNull();
        expect(query("login-totp")).not.toBeNull();
        expect(fixture.nativeElement.textContent).toContain("verificationCodeTotp");
      });

      it("keeps the login credentials section for a key-only login when the flag is off", () => {
        upgradePathsFlag$.next(false);
        const cipher = totpCipher();
        cipher.login.username = undefined;
        fixture.componentRef.setInput("cipher", cipher);
        fixture.componentRef.setInput("activeUserId", userId);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain("loginCredentials");
        expect(query("login-totp")).not.toBeNull();
      });
    });

    describe("upgrade callout", () => {
      it("shows to a free user on a personal item who has not dismissed it", () => {
        render();

        expect(nudgesService.showNudgeSpotlight$).toHaveBeenCalledWith(
          NudgeType.PremiumUpgradeTotp,
          userId,
        );
        expect(query("totp-upgrade-callout")).not.toBeNull();
      });

      it("is hidden when the flag is off", () => {
        upgradePathsFlag$.next(false);
        render();

        expect(query("totp-upgrade-callout")).toBeNull();
        expect(nudgesService.showNudgeSpotlight$).not.toHaveBeenCalled();
      });

      it("is hidden when the host does not allow it", () => {
        render({ allow: false });

        expect(query("totp-upgrade-callout")).toBeNull();
      });

      it("is hidden without an active user", () => {
        render({ activeUserId: null });

        expect(query("totp-upgrade-callout")).toBeNull();
      });

      it("is hidden on an org-owned item", () => {
        render({ organizationId: "org-id" });

        expect(query("totp-upgrade-callout")).toBeNull();
      });
    });

    describe("premium badge", () => {
      const badge = () => fixture.nativeElement.querySelector("app-premium-badge");

      it("shows as a plain label on a personal item where the host does not allow the callout", () => {
        render({ allow: false });

        expect(query("login-totp")).not.toBeNull();
        expect(badge()).not.toBeNull();
        expect(query("org-totp-upgrade")).toBeNull();
      });

      it("is not shown on a personal item where the callout replaces the code", () => {
        render();

        expect(query("login-totp")).toBeNull();
        expect(badge()).toBeNull();
      });

      it("shows on an org-owned item, and clicking it opens today's prompt for that organization", () => {
        render({ organizationId: "org-id" });

        expect(badge()).not.toBeNull();
        expect(query("org-totp-upgrade").className).toContain("focus-visible:tw-ring-border-focus");
        query("org-totp-upgrade").click();

        expect(premiumUpgradePromptService.promptForPremium).toHaveBeenCalledWith("org-id");
        expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).not.toHaveBeenCalled();
      });

      it("is not wrapped in the upgrade button when the flag is off", () => {
        upgradePathsFlag$.next(false);
        render({ organizationId: "org-id" });

        expect(badge()).not.toBeNull();
        expect(query("org-totp-upgrade")).toBeNull();
      });

      it.each([undefined, "org-id"])(
        "shows when the flag is off (organizationId %s)",
        (organizationId) => {
          upgradePathsFlag$.next(false);
          render({ organizationId });

          expect(badge()).not.toBeNull();
        },
      );
    });
  });
});
