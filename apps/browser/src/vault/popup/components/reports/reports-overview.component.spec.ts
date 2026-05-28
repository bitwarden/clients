import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, EMPTY, of, Subject } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  BillingAccountProfileStateService,
  BillingApiServiceAbstraction,
} from "@bitwarden/common/billing/abstractions";
import { PremiumPlanResponse } from "@bitwarden/common/billing/models/response/premium-plan.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import {
  PersonalVaultRiskProgress,
  PersonalVaultRiskSummary,
} from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { StateProvider } from "@bitwarden/state";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { HealthIntroService } from "../../services/health-intro.service";
import {
  PersonalVaultAlertService,
  PersonalVaultAlertSummary,
} from "../../services/personal-vault-alert.service";

import { ReportsOverviewComponent } from "./reports-overview.component";

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ selector: "popup-page", template: `<ng-content></ng-content>` })
class MockPopupPageComponent {}

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ selector: "popup-header", template: `<ng-content></ng-content>` })
class MockPopupHeaderComponent {
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() pageTitle = "";
}

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ selector: "app-pop-out", template: "" })
class MockPopOutComponent {}

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ selector: "app-current-account", template: "" })
class MockCurrentAccountComponent {}

describe("ReportsOverviewComponent", () => {
  const userId = "00000000-0000-0000-0000-000000000001" as UserId;

  let fixture: ComponentFixture<ReportsOverviewComponent>;
  let component: ReportsOverviewComponent;

  let isScanning$: BehaviorSubject<boolean>;
  let summary$: Subject<PersonalVaultAlertSummary>;
  let progress$: Subject<PersonalVaultRiskProgress>;
  let totalCount$: BehaviorSubject<number>;
  let hasSeenIntro$: BehaviorSubject<boolean>;
  let isPremium$: BehaviorSubject<boolean>;

  let alertService: MockProxy<PersonalVaultAlertService>;
  let healthIntroService: MockProxy<HealthIntroService>;
  let billingService: MockProxy<BillingAccountProfileStateService>;
  let cipherService: MockProxy<CipherService>;
  let cipherListViews$: BehaviorSubject<CipherView[]>;
  let billingApiService: MockProxy<BillingApiServiceAbstraction>;
  let environmentService: MockProxy<EnvironmentService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let stateProvider: FakeStateProvider;

  const makePremiumPlanResponse = (annualPrice: number | undefined): PremiumPlanResponse =>
    ({
      seat: annualPrice != null ? { price: annualPrice } : undefined,
      storage: { provided: 1, price: 0 },
    }) as unknown as PremiumPlanResponse;

  const makeSummary = (
    overrides: Partial<PersonalVaultRiskSummary> = {},
    totalCount = 0,
  ): PersonalVaultAlertSummary => ({
    exposed: [],
    weak: [],
    reused: [],
    riskCounts: new Map(),
    scannedAt: new Date("2026-05-14T00:00:00Z"),
    totalCount,
    ...overrides,
  });

  beforeEach(async () => {
    isScanning$ = new BehaviorSubject<boolean>(false);
    summary$ = new Subject<PersonalVaultAlertSummary>();
    progress$ = new Subject<PersonalVaultRiskProgress>();
    totalCount$ = new BehaviorSubject<number>(0);
    hasSeenIntro$ = new BehaviorSubject<boolean>(true);
    isPremium$ = new BehaviorSubject<boolean>(true);

    alertService = mock<PersonalVaultAlertService>();
    (alertService as any).isScanning$ = isScanning$;
    (alertService as any).summary$ = summary$;
    (alertService as any).progress$ = progress$;
    (alertService as any).totalCount$ = totalCount$;
    (alertService as any).autoUndismiss$ = EMPTY;

    healthIntroService = mock<HealthIntroService>();
    (healthIntroService as any).healthIntroDismissed$ = hasSeenIntro$;
    (healthIntroService as any).healthBerryDismissed$ = new BehaviorSubject<boolean>(false);
    healthIntroService.setHealthIntroDismissed.mockResolvedValue(undefined);
    healthIntroService.setHealthBerryDismissed.mockResolvedValue(undefined);

    billingService = mock<BillingAccountProfileStateService>();
    billingService.hasPremiumFromAnySource$.mockReturnValue(isPremium$);

    cipherListViews$ = new BehaviorSubject<CipherView[]>([]);
    cipherService = mock<CipherService>();
    cipherService.cipherListViews$.mockReturnValue(cipherListViews$);

    billingApiService = mock<BillingApiServiceAbstraction>();
    billingApiService.getPremiumPlan.mockResolvedValue(makePremiumPlanResponse(10));

    environmentService = mock<EnvironmentService>();
    (environmentService as any).cloudWebVaultUrl$ = of("https://vault.bitwarden.com");

    platformUtilsService = mock<PlatformUtilsService>();

    const fakeAccountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(fakeAccountService);

    await TestBed.configureTestingModule({
      imports: [ReportsOverviewComponent, RouterTestingModule],
      providers: [
        { provide: PersonalVaultAlertService, useValue: alertService },
        { provide: HealthIntroService, useValue: healthIntroService },
        { provide: BillingAccountProfileStateService, useValue: billingService },
        { provide: CipherService, useValue: cipherService },
        { provide: BillingApiServiceAbstraction, useValue: billingApiService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: StateProvider, useValue: stateProvider },
        {
          provide: ThemeStateService,
          useValue: { selectedTheme$: of("light") },
        },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: of("light") },
        { provide: AccountService, useValue: fakeAccountService },
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: string[]) =>
              args.length > 0 ? `${key}:${args.join(",")}` : key,
            translate: (key: string) => key,
            translationLocale: "en",
          },
        },
      ],
    })
      .overrideComponent(ReportsOverviewComponent, {
        remove: {
          imports: [
            PopupPageComponent,
            PopupHeaderComponent,
            PopOutComponent,
            CurrentAccountComponent,
          ],
        },
        add: {
          imports: [
            MockPopupPageComponent,
            MockPopupHeaderComponent,
            MockPopOutComponent,
            MockCurrentAccountComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReportsOverviewComponent);
    component = fixture.componentInstance;
  });

  describe("class behavior", () => {
    it("dismissIntro() calls healthIntroService.setHealthIntroDismissed", async () => {
      await component.dismissIntro();

      expect(healthIntroService.setHealthIntroDismissed).toHaveBeenCalledTimes(1);
    });

    it("ngOnInit dismisses the health berry on tab visit", () => {
      fixture.detectChanges();

      expect(healthIntroService.setHealthBerryDismissed).toHaveBeenCalledTimes(1);
    });
  });

  describe("template branches", () => {
    it("renders the upgrade banner with monthly price when not premium", async () => {
      isPremium$.next(false);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const upgradeButton = fixture.debugElement.query(By.css("button[bitButton]"));
      expect(upgradeButton).toBeTruthy();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("upgradeToPremium");
      // Annual price 10 / 12 ≈ 0.83
      expect(text).toMatch(/0\.83/);
      expect(text).toContain("monthly");
    });

    it("hides the upgrade banner when premium", async () => {
      isPremium$.next(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      // Banner is non-premium only — no upgradeToPremium copy in the rendered view.
      expect(text).not.toContain("upgradeToPremium");
    });

    it("hides the monthly price when the pricing API errors", async () => {
      billingApiService.getPremiumPlan.mockRejectedValue(new Error("boom"));
      isPremium$.next(false);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const upgradeButton = fixture.debugElement.query(By.css("button[bitButton]"));
      expect(upgradeButton).toBeTruthy();
      const text = fixture.nativeElement.textContent as string;
      expect(text).not.toMatch(/\$\d/);
    });

    it("launches the web vault subscription URL when the upgrade button is clicked", async () => {
      isPremium$.next(false);
      fixture.detectChanges();

      await component.upgradeToPremium();

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://vault.bitwarden.com/#/settings/subscription/premium",
      );
    });

    it("hides the monthly price when annualPrice is undefined (self-hosted)", async () => {
      billingApiService.getPremiumPlan.mockResolvedValue(makePremiumPlanResponse(undefined));
      isPremium$.next(false);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).not.toMatch(/\$\d/);
    });

    it("renders the intro prompt when premium and hasSeenIntro$ is false", () => {
      hasSeenIntro$.next(false);
      fixture.detectChanges();

      // The intro CTA button shows the "scanMyVault" copy.
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("introducingHealth");
      expect(text).toContain("scanMyVault");
    });

    it("renders the progress bar while isScanning$ is true", () => {
      isScanning$.next(true);
      fixture.detectChanges();
      progress$.next({
        type: "progress",
        phase: "preparing",
        processed: 0,
        total: 10,
        percent: 25,
      });
      fixture.detectChanges();

      const progressBar = fixture.debugElement.query(By.css("bit-progress-bar"));
      expect(progressBar).toBeTruthy();
    });

    it("renders the summary block with category counts once a scan completes", () => {
      const c = (id: string) => ({ id }) as any;
      isScanning$.next(false);
      fixture.detectChanges();
      summary$.next(
        makeSummary(
          { exposed: [c("a"), c("b")], weak: [c("c")], reused: [c("d"), c("e"), c("f")] },
          6,
        ),
      );
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("exposedPasswords");
      expect(text).toContain("weakPasswords");
      expect(text).toContain("reusedPasswords");
      // The counts (2, 1, 3) and total render in the same view.
      expect(text).toMatch(/2/);
      expect(text).toMatch(/1/);
      expect(text).toMatch(/3/);
    });
  });
});
