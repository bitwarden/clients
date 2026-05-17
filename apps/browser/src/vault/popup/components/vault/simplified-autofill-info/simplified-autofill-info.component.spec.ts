import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/state";

import { SimplifiedAutofillInfoComponent } from "./simplified-autofill-info.component";

describe("SimplifiedAutofillInfoComponent", () => {
  let fixture: ComponentFixture<SimplifiedAutofillInfoComponent>;

  const getUserState$ = jest.fn().mockReturnValue(of(null));
  const getFeatureFlag$ = jest.fn().mockReturnValue(of(true));
  const activeAccount$ = new BehaviorSubject({ id: "test-user-id" });

  beforeEach(async () => {
    // Mock getAnimations for all span elements before any components are created
    if (!HTMLSpanElement.prototype.getAnimations) {
      HTMLSpanElement.prototype.getAnimations = jest.fn().mockReturnValue([]);
    }

    await TestBed.configureTestingModule({
      imports: [SimplifiedAutofillInfoComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$ },
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: activeAccount$ },
        },
        {
          provide: StateProvider,
          useValue: {
            getUserState$,
            getUser: jest.fn().mockReturnValue({
              update: jest.fn().mockResolvedValue(undefined),
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SimplifiedAutofillInfoComponent);
    fixture.detectChanges();
  });

  it("sets pingElement to hidden when animation finishes", async () => {
    const mockAnimation: Partial<Animation> & { animationName: string } = {
      animationName: "tw-ping",
      onfinish: null,
    };

    // Override the mock to return our specific animation
    (HTMLSpanElement.prototype.getAnimations as jest.Mock).mockReturnValue([
      mockAnimation as Animation,
    ]);

    // Create a new fixture with fresh mocks that will show the ping animation
    getUserState$.mockReturnValue(of({ hasSeen: false, hasDismissed: false }));

    const newFixture = TestBed.createComponent(SimplifiedAutofillInfoComponent);

    // Trigger change detection to render the template and run the effect
    newFixture.detectChanges();
    await newFixture.whenStable();

    expect(mockAnimation.onfinish).toBeDefined();
    expect(mockAnimation.onfinish).not.toBeNull();
    const onfinishHandler = mockAnimation.onfinish;

    await onfinishHandler.call(mockAnimation, null);

    const newPingElement = newFixture.nativeElement.querySelector("span");

    expect(newPingElement.hidden).toBe(true);
  });

  describe("shouldShowIcon$", () => {
    it("renders the icon button when feature flag is enabled and not dismissed", async () => {
      getUserState$.mockReturnValue(of({ hasSeen: false, hasDismissed: false }));

      const newFixture = TestBed.createComponent(SimplifiedAutofillInfoComponent);
      newFixture.detectChanges();
      await newFixture.whenStable();

      const button = newFixture.nativeElement.querySelector("button[type='button']");
      expect(button).toBeTruthy();
    });

    it("does not render icon button when dismissed", async () => {
      getFeatureFlag$.mockReturnValue(of(true));
      getUserState$.mockReturnValue(of({ hasSeen: true, hasDismissed: true }));

      const newFixture = TestBed.createComponent(SimplifiedAutofillInfoComponent);
      newFixture.detectChanges();
      await newFixture.whenStable();

      const button = newFixture.nativeElement.querySelector("button[type='button']");
      expect(button).toBeFalsy();
    });
  });

  describe("shouldShowPingAnimation$", () => {
    it("renders ping animation when not seen", async () => {
      getUserState$.mockReturnValue(of({ hasSeen: false, hasDismissed: false }));

      const newFixture = TestBed.createComponent(SimplifiedAutofillInfoComponent);
      newFixture.detectChanges();
      await newFixture.whenStable();

      const pingElement = newFixture.nativeElement.querySelector("span.tw-bg-primary-600");
      expect(pingElement).toBeTruthy();
    });

    it("does not render ping animation when already seen", async () => {
      getUserState$.mockReturnValue(of({ hasSeen: true, hasDismissed: false }));

      const newFixture = TestBed.createComponent(SimplifiedAutofillInfoComponent);
      newFixture.detectChanges();
      await newFixture.whenStable();

      const pingElement = newFixture.nativeElement.querySelector("span.tw-bg-primary-600");
      expect(pingElement).toBeFalsy();
    });
  });
});
