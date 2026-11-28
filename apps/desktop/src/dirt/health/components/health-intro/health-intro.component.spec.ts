import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { HealthIntroComponent } from "./health-intro.component";

describe("HealthIntroComponent", () => {
  let fixture: ComponentFixture<HealthIntroComponent>;
  let theme$: BehaviorSubject<ThemeTypes>;

  function scanButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector("button");
  }

  beforeEach(async () => {
    theme$ = new BehaviorSubject<ThemeTypes>(ThemeTypes.Light);
    await TestBed.configureTestingModule({
      imports: [HealthIntroComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AbstractThemingService, useValue: { theme$ } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthIntroComponent);
    fixture.detectChanges();
  });

  it("renders the introduction copy", () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain("introducingHealth");
    expect(text).toContain("healthIntroDescription");
  });

  it("emits when the scan button is clicked", () => {
    const emitted = jest.fn();
    fixture.componentInstance.onTriggerHealthScan.subscribe(emitted);

    scanButton().click();

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it("renders the light illustration by default and the dark one in the dark theme", () => {
    const img = (): HTMLImageElement =>
      fixture.nativeElement.querySelector("[data-testid='health-intro-illustration']");

    expect(img().getAttribute("src")).toBe("images/health-tab/health_intro.png");

    theme$.next(ThemeTypes.Dark);
    fixture.detectChanges();

    expect(img().getAttribute("src")).toBe("images/health-tab/health_intro_dark.png");
  });
});
