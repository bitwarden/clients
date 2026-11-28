import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { BadgeComponent, BitIconButtonComponent, ChipActionComponent } from "@bitwarden/components";

import { PremiumBadgeComponent } from "./premium-badge.component";

describe("PremiumBadgeComponent", () => {
  let fixture: ComponentFixture<PremiumBadgeComponent>;

  const flag$ = new BehaviorSubject<boolean>(false);
  const hasPremium$ = new BehaviorSubject<boolean>(false);
  const configService = mock<ConfigService>();
  const promptService = mock<PremiumUpgradePromptService>();
  const i18nService = mock<I18nService>();
  const accountService = mock<AccountService>();
  const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();

  beforeEach(async () => {
    flag$.next(false);
    hasPremium$.next(false);
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key) => key);
    configService.getFeatureFlag$.mockImplementation((flag) =>
      flag === FeatureFlag.PM42214_FeatureBasedUpgradePaths ? flag$ : of(false),
    );
    accountService.activeAccount$ = of({ id: "user-1" } as Account);
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(hasPremium$);

    await TestBed.configureTestingModule({
      imports: [PremiumBadgeComponent],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: ConfigService, useValue: configService },
        { provide: PremiumUpgradePromptService, useValue: promptService },
        { provide: AccountService, useValue: accountService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
      ],
    }).compileComponents();
  });

  /** Create the component after flag/input setup. */
  async function render(opts: { iconOnly?: boolean; organizationId?: string } = {}) {
    fixture = TestBed.createComponent(PremiumBadgeComponent);
    if (opts.iconOnly != null) {
      fixture.componentRef.setInput("iconOnly", opts.iconOnly);
    }
    if (opts.organizationId != null) {
      fixture.componentRef.setInput("organizationId", opts.organizationId);
    }
    fixture.detectChanges();
    // *appNotPremium resolves the active account asynchronously before it renders.
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const chip = () => fixture.debugElement.query(By.directive(ChipActionComponent));
  const iconButton = () => fixture.debugElement.query(By.directive(BitIconButtonComponent));
  const badge = () => fixture.debugElement.query(By.directive(BadgeComponent));
  const clickEvent = () => ({ stopPropagation: jest.fn(), preventDefault: jest.fn() }) as any;

  describe("flag off", () => {
    it("renders today's Upgrade chip and calls promptForPremium on click", async () => {
      await render({ organizationId: "org-1" });

      expect(chip()).not.toBeNull();
      expect(chip().componentInstance.label()).toBe("upgrade");

      const event = clickEvent();
      chip().triggerEventHandler("click", event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
      expect(promptService.promptForPremium).toHaveBeenCalledWith("org-1");
    });

    it("renders today's icon button when iconOnly", async () => {
      await render({ iconOnly: true });

      expect(iconButton()).not.toBeNull();
      expect(iconButton().componentInstance.label()).toBe("upgradeToPremium");
      expect(chip()).toBeNull();
    });
  });

  describe("flag on", () => {
    beforeEach(() => flag$.next(true));

    it("renders a non-clickable Premium badge and calls no service", async () => {
      await render({ organizationId: "org-1" });

      expect(badge()).not.toBeNull();
      expect(badge().nativeElement.textContent.trim()).toBe("premium");
      expect(chip()).toBeNull();
      expect(promptService.promptForPremium).not.toHaveBeenCalled();
    });

    it("renders the Premium badge regardless of iconOnly", async () => {
      await render({ iconOnly: true });

      expect(badge()).not.toBeNull();
      expect(chip()).toBeNull();
      expect(iconButton()).toBeNull();
    });
  });

  describe("premium user", () => {
    it.each([
      ["flag off chip", false, false],
      ["flag off iconOnly", false, true],
      ["flag on", true, false],
    ])("stays hidden: %s", async (_label, flagOn, iconOnly) => {
      flag$.next(flagOn);
      hasPremium$.next(true);

      await render({ iconOnly });

      expect(chip()).toBeNull();
      expect(iconButton()).toBeNull();
      expect(badge()).toBeNull();
    });
  });
});
