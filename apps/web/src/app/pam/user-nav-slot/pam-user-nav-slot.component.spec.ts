import { NO_ERRORS_SCHEMA, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { I18nMockService, NavigationModule } from "@bitwarden/components";
import { CoachmarkService } from "@bitwarden/vault";

import { PamNavBadgeService } from "../pam-nav-badge.service";

import { PamUserNavSlotComponent } from "./pam-user-nav-slot.component";

const coachmarkI18n = {
  learnMore: "Learn more",
  coachmarkStepsIndicator: "step",
  back: "Back",
  done: "Done",
  next: "Next",
};

function coachmarkService(): CoachmarkService {
  const service = mock<CoachmarkService>({
    currentStepNumber: signal(1),
    totalSteps: signal(1),
  });
  service.isStepActive.mockReturnValue(false);
  service.getStepTitle.mockReturnValue("");
  service.getStepDescription.mockReturnValue("");
  return service;
}

describe("PamUserNavSlotComponent", () => {
  let fixture: ComponentFixture<PamUserNavSlotComponent>;
  let pamEnabled$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<Organization[]>;
  let getFeatureFlag$: jest.Mock;
  let badgeCount$: BehaviorSubject<number>;

  const pamOrg = { usePam: true } as Organization;
  const nonPamOrg = { usePam: false } as Organization;

  beforeEach(async () => {
    pamEnabled$ = new BehaviorSubject<boolean>(true);
    organizations$ = new BehaviorSubject<Organization[]>([pamOrg]);
    getFeatureFlag$ = jest.fn().mockReturnValue(pamEnabled$);
    badgeCount$ = new BehaviorSubject<number>(0);

    await TestBed.configureTestingModule({
      imports: [PamUserNavSlotComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "user-id" as UserId }) },
        },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: CoachmarkService, useValue: coachmarkService() },
        { provide: PamNavBadgeService, useValue: { count$: badgeCount$ } },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            pamAccessRequestsTitle: "Access requests",
            ...coachmarkI18n,
          }),
        },
      ],
    })
      // Stub the nav components so the test covers this component's gating, not their rendering.
      .overrideComponent(PamUserNavSlotComponent, {
        remove: { imports: [NavigationModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PamUserNavSlotComponent);
  });

  const navItem = () => fixture.debugElement.query(By.css("bit-nav-item"));

  it("gates on the PAM feature flag", () => {
    fixture.detectChanges();
    expect(getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.Pam);
  });

  it("renders the nav item when the flag is on and the user is in a PAM-enabled org", () => {
    fixture.detectChanges();
    expect(navItem()).not.toBeNull();
  });

  it("renders nothing when the flag is off", () => {
    pamEnabled$.next(false);
    fixture.detectChanges();
    expect(navItem()).toBeNull();
  });

  it("renders nothing when no organization has PAM enabled", () => {
    organizations$.next([nonPamOrg]);
    fixture.detectChanges();
    expect(navItem()).toBeNull();
  });

  it("keeps the nav item for a member unlicensed for PAM, so My requests stays reachable to withdraw", () => {
    organizations$.next([{ usePam: true, accessPam: false } as Organization]);
    fixture.detectChanges();
    expect(navItem()).not.toBeNull();
  });

  it("generates no box of its own, so rendering nothing takes up no space", () => {
    organizations$.next([nonPamOrg]);
    fixture.detectChanges();

    expect(navItem()).toBeNull();
    expect(fixture.debugElement.nativeElement.classList).toContain("tw-contents");
  });

  describe("the pending-count badge", () => {
    const badge = () => fixture.debugElement.query(By.css("[bitBadge]"));

    it("renders no badge at a count of zero", () => {
      fixture.detectChanges();

      expect(navItem()).not.toBeNull();
      expect(badge()).toBeNull();
    });

    it("renders the count once there is something to act on", () => {
      badgeCount$.next(3);
      fixture.detectChanges();

      expect(badge()?.nativeElement.textContent.trim()).toBe("3");
    });

    it("drops the badge again when the count returns to zero", () => {
      badgeCount$.next(2);
      fixture.detectChanges();
      expect(badge()).not.toBeNull();

      badgeCount$.next(0);
      fixture.detectChanges();

      expect(badge()).toBeNull();
    });

    it("falls back to no badge when the commercial seam is unprovided", async () => {
      // An optional `inject` yields null whether unprovided or provided as null, so this is the
      // OSS-only build's code path.
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [PamUserNavSlotComponent],
        providers: [
          { provide: ConfigService, useValue: { getFeatureFlag$ } },
          {
            provide: AccountService,
            useValue: { activeAccount$: new BehaviorSubject({ id: "user-id" as UserId }) },
          },
          { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
          { provide: PamNavBadgeService, useValue: null },
          { provide: CoachmarkService, useValue: coachmarkService() },
          {
            provide: I18nService,
            useValue: new I18nMockService({
              pamAccessRequestsTitle: "Access requests",
              ...coachmarkI18n,
            }),
          },
        ],
      })
        .overrideComponent(PamUserNavSlotComponent, {
          remove: { imports: [NavigationModule] },
          add: { schemas: [NO_ERRORS_SCHEMA] },
        })
        .compileComponents();

      fixture = TestBed.createComponent(PamUserNavSlotComponent);
      fixture.detectChanges();

      expect(navItem()).not.toBeNull();
      expect(badge()).toBeNull();
    });
  });
});
