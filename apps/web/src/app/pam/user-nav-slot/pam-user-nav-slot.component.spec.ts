import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BadgeModule, I18nMockService, NavigationModule } from "@bitwarden/components";

import { ApproverInboxBadgeService } from "../approver-inbox/approver-inbox-badge.service";

import { PamUserNavSlotComponent } from "./pam-user-nav-slot.component";

describe("PamUserNavSlotComponent", () => {
  let fixture: ComponentFixture<PamUserNavSlotComponent>;
  let pamEnabled$: BehaviorSubject<boolean>;
  let count$: BehaviorSubject<number>;
  let getFeatureFlag$: jest.Mock;

  beforeEach(async () => {
    pamEnabled$ = new BehaviorSubject<boolean>(true);
    count$ = new BehaviorSubject<number>(0);
    getFeatureFlag$ = jest.fn().mockReturnValue(pamEnabled$);

    await TestBed.configureTestingModule({
      imports: [PamUserNavSlotComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
        { provide: ApproverInboxBadgeService, useValue: { count$ } },
        {
          provide: I18nService,
          useValue: new I18nMockService({ pamInboxNav: "Approvals" }),
        },
      ],
    })
      // Stub the nav-item/badge child components so the test exercises this
      // component's own flag-gating and badge-count logic, not their rendering.
      .overrideComponent(PamUserNavSlotComponent, {
        remove: { imports: [BadgeModule, NavigationModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PamUserNavSlotComponent);
  });

  const navItem = () => fixture.debugElement.query(By.css("bit-nav-item"));
  const badge = () => fixture.debugElement.query(By.css("[bitBadge]"));

  it("gates on the PAM feature flag", () => {
    fixture.detectChanges();
    expect(getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.Pam);
  });

  it("renders the approver-inbox nav item when the flag is on", () => {
    fixture.detectChanges();

    const item = navItem();
    expect(item).not.toBeNull();
    expect(item.nativeElement.getAttribute("route")).toBe("pam/approver-inbox");
  });

  it("renders nothing when the flag is off", () => {
    pamEnabled$.next(false);
    fixture.detectChanges();

    expect(navItem()).toBeNull();
  });

  it("hides the nav item when the flag toggles off at runtime", () => {
    fixture.detectChanges();
    expect(navItem()).not.toBeNull();

    pamEnabled$.next(false);
    fixture.detectChanges();

    expect(navItem()).toBeNull();
  });

  it("hides the badge when the inbox count is zero", () => {
    fixture.detectChanges();
    expect(badge()).toBeNull();
  });

  it("shows the badge with the pending count when the inbox has requests", () => {
    count$.next(3);
    fixture.detectChanges();

    expect(badge()).not.toBeNull();
    expect(badge().nativeElement.textContent.trim()).toBe("3");
  });

  it("updates the badge as the count changes", () => {
    count$.next(2);
    fixture.detectChanges();
    expect(badge().nativeElement.textContent.trim()).toBe("2");

    count$.next(5);
    fixture.detectChanges();
    expect(badge().nativeElement.textContent.trim()).toBe("5");

    count$.next(0);
    fixture.detectChanges();
    expect(badge()).toBeNull();
  });
});
