import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SimplifiedAutofillInfoComponent } from "./simplified-autofill-info.component";

describe("SimplifiedAutofillInfoComponent", () => {
  let fixture: ComponentFixture<SimplifiedAutofillInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimplifiedAutofillInfoComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SimplifiedAutofillInfoComponent);
    fixture.detectChanges();
  });

  it("sets pingElement to hidden when animation finishes", () => {
    const mockAnimation: Partial<Animation> & { animationName: string } = {
      animationName: "tw-ping",
      onfinish: null,
    };

    const newFixture = TestBed.createComponent(SimplifiedAutofillInfoComponent);

    // Get the ping element and mock getAnimations before detectChanges triggers ngAfterViewInit
    const pingElement = newFixture.nativeElement.querySelector("span");
    jest.spyOn(pingElement, "getAnimations").mockReturnValue([mockAnimation as Animation]);

    // Trigger ngAfterViewInit
    newFixture.detectChanges();

    expect(mockAnimation.onfinish).toBeDefined();
    expect(mockAnimation.onfinish).not.toBeNull();

    const onfinishHandler = mockAnimation.onfinish;
    onfinishHandler.call(mockAnimation as Animation, null);

    expect(pingElement.hidden).toBe(true);
  });
});
