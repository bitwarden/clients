import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, NEVER, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  PASSKEY_OPPORTUNITIES_IDLE,
  PasskeyOpportunitiesState,
  VaultHealthReportStatus,
} from "@bitwarden/common/dirt/vault-health/models";
import { PasskeyOpportunityService } from "@bitwarden/common/dirt/vault-health/services";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";

import { HealthPasskeyScanService } from "../../services/health-passkey-scan.service";
import { PasskeyOpportunityNavItemComponent } from "../passkey-opportunity-nav-item/passkey-opportunity-nav-item.component";

import { HealthPasskeySectionComponent } from "./health-passkey-section.component";

@Component({
  selector: "dirt-passkey-opportunity-nav-item",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockNavItemComponent {
  readonly status = input<VaultHealthReportStatus>();
  readonly count = input<number | null>();
  readonly locked = input(false);
  readonly retry = output<void>();
}

describe("HealthPasskeySectionComponent", () => {
  const userId = "user-1" as UserId;

  let fixture: ComponentFixture<HealthPasskeySectionComponent>;
  let flag$: BehaviorSubject<boolean>;
  let state$: BehaviorSubject<PasskeyOpportunitiesState>;
  let opportunityService: MockProxy<PasskeyOpportunityService>;
  let scanService: MockProxy<HealthPasskeyScanService>;
  let configService: MockProxy<ConfigService>;

  async function init(locked: boolean) {
    fixture = TestBed.createComponent(HealthPasskeySectionComponent);
    fixture.componentRef.setInput("locked", locked);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function navItem(): MockNavItemComponent | null {
    return (
      fixture.debugElement.query(By.directive(MockNavItemComponent))?.componentInstance ?? null
    );
  }

  beforeEach(async () => {
    flag$ = new BehaviorSubject(true);
    state$ = new BehaviorSubject<PasskeyOpportunitiesState>(PASSKEY_OPPORTUNITIES_IDLE);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(flag$);
    opportunityService = mock<PasskeyOpportunityService>();
    opportunityService.getPasskeyOpportunities$.mockReturnValue(state$);
    scanService = mock<HealthPasskeyScanService>();
    scanService.keepPasskeysCurrent$.mockReturnValue(NEVER);

    await TestBed.configureTestingModule({
      imports: [HealthPasskeySectionComponent],
      providers: [
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId } as Account) } },
        { provide: ConfigService, useValue: configService },
        { provide: PasskeyOpportunityService, useValue: opportunityService },
        { provide: HealthPasskeyScanService, useValue: scanService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideComponent(HealthPasskeySectionComponent, {
        remove: { imports: [PasskeyOpportunityNavItemComponent] },
        add: { imports: [MockNavItemComponent] },
      })
      .compileComponents();
  });

  it("is gated on the passkey report feature flag", async () => {
    await init(false);

    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.PasskeyLoginReport);
  });

  it("renders the heading and an unlocked row, and starts the check, for a Premium user", async () => {
    await init(false);

    expect(fixture.nativeElement.textContent).toContain("healthRecommendations");
    expect(navItem()!.locked()).toBe(false);
    expect(scanService.keepPasskeysCurrent$).toHaveBeenCalledWith(userId);
  });

  it("renders nothing and checks nothing when the flag is off", async () => {
    flag$.next(false);
    await init(false);

    expect(navItem()).toBeNull();
    expect(scanService.keepPasskeysCurrent$).not.toHaveBeenCalled();
  });

  it("renders a locked row for a free user without checking the directory", async () => {
    await init(true);

    expect(fixture.nativeElement.textContent).toContain("healthRecommendations");
    expect(navItem()!.locked()).toBe(true);
    expect(scanService.keepPasskeysCurrent$).not.toHaveBeenCalled();
    expect(opportunityService.getPasskeyOpportunities$).not.toHaveBeenCalled();
  });

  it("starts the check once a free user upgrades, with no reload", async () => {
    await init(true);

    fixture.componentRef.setInput("locked", false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navItem()!.locked()).toBe(false);
    expect(scanService.keepPasskeysCurrent$).toHaveBeenCalledWith(userId);
  });

  it("passes no count before a result, then the number of opportunities", async () => {
    await init(false);
    expect(navItem()!.count()).toBeNull();
    expect(navItem()!.status()).toBe(VaultHealthReportStatus.Idle);

    state$.next({
      status: VaultHealthReportStatus.Success,
      opportunities: [
        { id: "a", supportsPasskeyLogin: true, supportsPasskeyMfa: false },
        { id: "b", supportsPasskeyLogin: false, supportsPasskeyMfa: true },
      ],
    });
    fixture.detectChanges();

    expect(navItem()!.count()).toBe(2);
    expect(navItem()!.status()).toBe(VaultHealthReportStatus.Success);
  });

  it("retries the check for the active user when the row asks", async () => {
    state$.next({ status: VaultHealthReportStatus.Error, opportunities: null });
    await init(false);

    navItem()!.retry.emit();

    expect(scanService.retry).toHaveBeenCalledWith(userId);
  });
});
