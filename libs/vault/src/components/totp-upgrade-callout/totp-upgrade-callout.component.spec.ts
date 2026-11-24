import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PremiumUpgradeNudgeService } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";

import { TOTP_NUDGE_OPTIONS } from "../../premium-upgrade-nudge-options";

import { TotpUpgradeCalloutComponent } from "./totp-upgrade-callout.component";

describe("TotpUpgradeCalloutComponent", () => {
  const userId = "user-id" as UserId;

  let fixture: ComponentFixture<TotpUpgradeCalloutComponent>;
  let hasPremium$: BehaviorSubject<boolean>;
  let nudgeActive$: BehaviorSubject<boolean>;
  let nudgesService: MockProxy<NudgesService>;
  let premiumUpgradeNudgeService: MockProxy<PremiumUpgradeNudgeService>;

  const query = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid='${testId}']`);

  const render = (organizationId: string | null = null) => {
    fixture = TestBed.createComponent(TotpUpgradeCalloutComponent);
    fixture.componentRef.setInput("userId", userId);
    fixture.componentRef.setInput("organizationId", organizationId);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    hasPremium$ = new BehaviorSubject(false);
    nudgeActive$ = new BehaviorSubject(true);
    nudgesService = mock<NudgesService>();
    nudgesService.showNudgeSpotlight$.mockReturnValue(nudgeActive$);
    premiumUpgradeNudgeService = mock<PremiumUpgradeNudgeService>();
    const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(hasPremium$);

    await TestBed.configureTestingModule({
      imports: [TotpUpgradeCalloutComponent],
      providers: [
        { provide: NudgesService, useValue: nudgesService },
        { provide: PremiumUpgradeNudgeService, useValue: premiumUpgradeNudgeService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();
  });

  it("shows to a free user on a personal item who has not dismissed it", () => {
    render();

    expect(nudgesService.showNudgeSpotlight$).toHaveBeenCalledWith(
      NudgeType.PremiumUpgradeTotp,
      userId,
    );
    expect(query("totp-upgrade-callout")).not.toBeNull();
  });

  it("is hidden for a Premium user", () => {
    hasPremium$.next(true);
    render();

    expect(query("totp-upgrade-callout")).toBeNull();
  });

  it("is hidden once dismissed", () => {
    nudgeActive$.next(false);
    render();

    expect(query("totp-upgrade-callout")).toBeNull();
  });

  it("is hidden on an organization-owned item", () => {
    render("org-id");

    expect(query("totp-upgrade-callout")).toBeNull();
  });

  it("dismisses the TOTP nudge for the user from the close button", () => {
    render();

    query("bit-callout-close")!.click();

    expect(nudgesService.dismissNudge).toHaveBeenCalledWith(NudgeType.PremiumUpgradeTotp, userId);
  });

  it("opens the TOTP upgrade nudge once from the Upgrade button", () => {
    render();

    query("totp-upgrade-button")!.click();

    expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).toHaveBeenCalledTimes(1);
    expect(premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge).toHaveBeenCalledWith(
      TOTP_NUDGE_OPTIONS,
    );
  });
});
