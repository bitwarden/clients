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

function org(canManageAccessRules: boolean): Organization {
  return { canManageAccessRules } as Organization;
}

describe("PamOrgNavSlotComponent", () => {
  let fixture: ComponentFixture<PamOrgNavSlotComponent>;
  let pamEnabled$: BehaviorSubject<boolean>;
  let getFeatureFlag$: jest.Mock;

  beforeEach(async () => {
    pamEnabled$ = new BehaviorSubject<boolean>(true);
    getFeatureFlag$ = jest.fn().mockReturnValue(pamEnabled$);

    await TestBed.configureTestingModule({
      imports: [PamOrgNavSlotComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            pam: "Privileged access",
            pamAccessRules: "Access rules",
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

  it("renders nothing when the org cannot manage access rules", () => {
    fixture.componentRef.setInput("organization", org(false));
    fixture.detectChanges();
    expect(navGroup()).toBeNull();
  });
});
