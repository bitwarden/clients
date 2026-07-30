import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, NavigationModule } from "@bitwarden/components";

import { PamUserNavSlotComponent } from "./pam-user-nav-slot.component";

describe("PamUserNavSlotComponent", () => {
  let fixture: ComponentFixture<PamUserNavSlotComponent>;
  let pamEnabled$: BehaviorSubject<boolean>;
  let getFeatureFlag$: jest.Mock;

  beforeEach(async () => {
    pamEnabled$ = new BehaviorSubject<boolean>(true);
    getFeatureFlag$ = jest.fn().mockReturnValue(pamEnabled$);

    await TestBed.configureTestingModule({
      imports: [PamUserNavSlotComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            pamMyAccess: "My access",
          }),
        },
      ],
    })
      // Stub the nav child components so the test exercises this component's own flag-gating
      // logic, not their rendering.
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

  it("renders the nav item when the flag is on", () => {
    fixture.detectChanges();
    expect(navItem()).not.toBeNull();
  });

  it("renders nothing when the flag is off", () => {
    pamEnabled$.next(false);
    fixture.detectChanges();
    expect(navItem()).toBeNull();
  });
});
