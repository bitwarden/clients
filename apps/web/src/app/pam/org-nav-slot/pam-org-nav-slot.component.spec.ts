import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, NavigationModule, PopoverModule } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { CoachmarkComponent, CoachmarkService } from "@bitwarden/vault";

import { PamOrgNavSlotComponent } from "./pam-org-nav-slot.component";

@Component({
  selector: "vault-coachmark",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockCoachmarkComponent {
  popover(): undefined {
    return undefined;
  }
}

// Rotation defaults to the rules permission, which is the Owner/Admin case.
function org(
  canManageAccessRules: boolean,
  canAccessEventLogs = false,
  canManageRotation = canManageAccessRules,
): Organization {
  return {
    usePam: true,
    canManageAccessRules,
    canAccessEventLogs,
    canManageRotation,
  } as Organization;
}

describe("PamOrgNavSlotComponent", () => {
  let fixture: ComponentFixture<PamOrgNavSlotComponent>;
  let pamEnabled$: BehaviorSubject<boolean>;
  let rotationEnabled$: BehaviorSubject<boolean>;
  let getFeatureFlag$: jest.Mock;
  let coachmarkService: ReturnType<typeof mock<CoachmarkService>>;

  beforeEach(async () => {
    pamEnabled$ = new BehaviorSubject<boolean>(true);
    // Off by default, as the flag ships.
    rotationEnabled$ = new BehaviorSubject<boolean>(false);
    getFeatureFlag$ = jest.fn((flag: FeatureFlag) =>
      flag === FeatureFlag.PamAccessConnector ? rotationEnabled$ : pamEnabled$,
    );

    coachmarkService = mock<CoachmarkService>();
    coachmarkService.isStepActive.mockReturnValue(false);
    coachmarkService.startTour.mockResolvedValue();

    await TestBed.configureTestingModule({
      imports: [PamOrgNavSlotComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
        { provide: CoachmarkService, useValue: coachmarkService },
        { provide: StateProvider, useValue: mock<StateProvider>() },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            privilegedControls: "Privileged Controls",
            pamAccessRules: "Access rules",
            pamAuditLog: "Audit log",
            pamRotation: "Rotation",
          }),
        },
      ],
    })
      // Stub the nav components so the test covers this component's gating, not their rendering.
      .overrideComponent(PamOrgNavSlotComponent, {
        remove: { imports: [NavigationModule, PopoverModule, CoachmarkComponent] },
        add: { imports: [MockCoachmarkComponent], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PamOrgNavSlotComponent);
    fixture.componentRef.setInput("organization", org(true));
  });

  const navGroup = () => fixture.debugElement.query(By.css("bit-nav-group"));
  const navItemRoutes = () =>
    fixture.debugElement
      .queryAll(By.css("bit-nav-item"))
      .map((item) => item.attributes["route"] ?? item.properties["route"]);

  it("gates on the PAM feature flag", () => {
    fixture.detectChanges();
    expect(getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.Pam);
  });

  it("renders the PAM nav group when the flag is on and the org can manage access rules", () => {
    fixture.detectChanges();
    expect(navGroup()).not.toBeNull();
  });

  it("renders nothing when the flag is off", () => {
    pamEnabled$.next(false);
    fixture.detectChanges();
    expect(navGroup()).toBeNull();
  });

  it("renders nothing when the org has neither PAM permission", () => {
    fixture.componentRef.setInput("organization", org(false));
    fixture.detectChanges();
    expect(navGroup()).toBeNull();
  });

  it("renders nothing for an org without PAM, even when the member can read event logs", () => {
    fixture.componentRef.setInput("organization", { ...org(false, true), usePam: false });
    fixture.detectChanges();
    expect(navGroup()).toBeNull();
  });

  it("generates no box of its own, so rendering nothing takes up no space", () => {
    pamEnabled$.next(false);
    fixture.detectChanges();

    expect(navGroup()).toBeNull();
    expect(fixture.debugElement.nativeElement.classList).toContain("tw-contents");
  });

  it("shows only Access rules when the org cannot read event logs", () => {
    fixture.componentRef.setInput("organization", org(true, false));
    fixture.detectChanges();
    expect(navItemRoutes()).toEqual(["pam/access-rules"]);
  });

  it("shows only Audit log when the org cannot manage access rules", () => {
    fixture.componentRef.setInput("organization", org(false, true));
    fixture.detectChanges();
    expect(navGroup()).not.toBeNull();
    expect(navItemRoutes()).toEqual(["pam/audit"]);
  });

  it("shows both items when the org has both permissions", () => {
    fixture.componentRef.setInput("organization", org(true, true));
    fixture.detectChanges();
    expect(navItemRoutes()).toEqual(["pam/access-rules", "pam/audit"]);
  });

  describe("rotation", () => {
    it("gates on the rotation feature flag", () => {
      fixture.detectChanges();
      expect(getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.PamAccessConnector);
    });

    it("shows Rotation when its flag is on and the org can manage rotation", () => {
      rotationEnabled$.next(true);
      fixture.componentRef.setInput("organization", org(true, true));
      fixture.detectChanges();
      expect(navItemRoutes()).toEqual(["pam/access-rules", "pam/audit", "pam/rotation"]);
    });

    it("hides Rotation when its flag is off", () => {
      rotationEnabled$.next(false);
      fixture.componentRef.setInput("organization", org(true, true));
      fixture.detectChanges();
      expect(navItemRoutes()).not.toContain("pam/rotation");
    });

    it("hides Rotation when the org cannot manage rotation", () => {
      rotationEnabled$.next(true);
      fixture.componentRef.setInput("organization", org(false, true));
      fixture.detectChanges();
      expect(navItemRoutes()).toEqual(["pam/audit"]);
    });

    // A Custom user with ManageAccessRules authors rules but cannot manage connectors, so
    // Rotation would 403.
    it("hides Rotation from an org that can author rules but not manage rotation", () => {
      rotationEnabled$.next(true);
      fixture.componentRef.setInput("organization", org(true, false, false));
      fixture.detectChanges();
      expect(navItemRoutes()).toEqual(["pam/access-rules"]);
    });

    it("hides Rotation when the PAM flag is off, even with its own flag on", () => {
      pamEnabled$.next(false);
      rotationEnabled$.next(true);
      fixture.detectChanges();
      expect(navGroup()).toBeNull();
    });
  });

  describe("admin tour", () => {
    const startedStepIds = () => {
      const tour = coachmarkService.startTour.mock.calls[0][0];
      return tour.steps.map((step) => step.id);
    };

    it("starts the tour once the group has rendered, with only the visible items", async () => {
      rotationEnabled$.next(true);
      fixture.componentRef.setInput("organization", org(true, false));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(coachmarkService.startTour).toHaveBeenCalledTimes(1);
      expect(startedStepIds()).toEqual(["pamOrgGroup", "pamAccessRules", "pamRotation"]);
    });

    it("includes the audit log step for an org that can read event logs", async () => {
      fixture.componentRef.setInput("organization", org(false, true));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(startedStepIds()).toEqual(["pamOrgGroup", "pamAuditLog"]);
    });

    it("includes Rotation when its flag resolves after the PAM flag", async () => {
      // The Rotation flag is the slower of the two; the tour must wait for it, not snapshot a
      // placeholder `false` and then be marked completed without the step.
      pamEnabled$.next(true);
      rotationEnabled$.next(true);
      fixture.componentRef.setInput("organization", org(true, false));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(coachmarkService.startTour).toHaveBeenCalledTimes(1);
      expect(startedStepIds()).toContain("pamRotation");
    });

    it("requests the tour again when the organization changes", async () => {
      fixture.componentRef.setInput("organization", org(false, true));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.componentRef.setInput("organization", { ...org(true, false), id: "other-org" });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(coachmarkService.startTour).toHaveBeenCalledTimes(2);
    });

    it("does not start the tour when the group is hidden", async () => {
      pamEnabled$.next(false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(coachmarkService.startTour).not.toHaveBeenCalled();
    });
  });
});
