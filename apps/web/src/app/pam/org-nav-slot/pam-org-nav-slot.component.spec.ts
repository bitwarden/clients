import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, NavigationModule } from "@bitwarden/components";

import { PamOrgNavSlotComponent } from "./pam-org-nav-slot.component";

// Rule authorship and the rotation fleet are separate authorities, so they are separate
// arguments; connectors default to tracking rules, which is the Owner/Admin case.
function org(
  canManageAccessRules: boolean,
  canAccessEventLogs = false,
  canManageAccessConnectors = canManageAccessRules,
): Organization {
  return { canManageAccessRules, canAccessEventLogs, canManageAccessConnectors } as Organization;
}

describe("PamOrgNavSlotComponent", () => {
  let fixture: ComponentFixture<PamOrgNavSlotComponent>;
  let pamEnabled$: BehaviorSubject<boolean>;
  let rotationEnabled$: BehaviorSubject<boolean>;
  let getFeatureFlag$: jest.Mock;

  beforeEach(async () => {
    pamEnabled$ = new BehaviorSubject<boolean>(true);
    // Off by default, matching the flag's shipped default.
    rotationEnabled$ = new BehaviorSubject<boolean>(false);
    getFeatureFlag$ = jest.fn((flag: FeatureFlag) =>
      flag === FeatureFlag.PamRotation ? rotationEnabled$ : pamEnabled$,
    );

    await TestBed.configureTestingModule({
      imports: [PamOrgNavSlotComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            privilegedControls: "Privileged Controls",
            pamAccessRules: "Access rules",
            pamAuditLog: "Audit log",
            pamRotationNav: "Rotation",
          }),
        },
      ],
    })
      // Stub the nav child components so the test exercises this component's own flag-gating
      // logic, not their rendering.
      .overrideComponent(PamOrgNavSlotComponent, {
        remove: { imports: [NavigationModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
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

  it("generates no box of its own, so rendering nothing takes up no space", () => {
    pamEnabled$.next(false);
    fixture.detectChanges();

    expect(navGroup()).toBeNull();
    expect(fixture.debugElement.nativeElement.classList).toContain("tw-contents");
  });

  // The two items mirror their own routes' guards; managing access rules and reading event logs
  // are separate permissions.
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

  // Rotation nests under the PAM flag, its own flag, and the access-connector permission its
  // route guards on — which is Owner/Admin only, not the access-rule permission.
  describe("rotation", () => {
    it("gates on the rotation feature flag", () => {
      fixture.detectChanges();
      expect(getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.PamRotation);
    });

    it("shows Rotation when its flag is on and the org can manage access connectors", () => {
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

    it("hides Rotation when the org cannot manage access connectors", () => {
      rotationEnabled$.next(true);
      fixture.componentRef.setInput("organization", org(false, true));
      fixture.detectChanges();
      expect(navItemRoutes()).toEqual(["pam/audit"]);
    });

    // A Custom user holding ManageAccessRules authors rules but has no authority over the
    // connectors that rotate their credentials, so Rotation would 403.
    it("hides Rotation from an org that can author rules but not manage connectors", () => {
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
});
