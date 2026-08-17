import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { HealthIntroComponent } from "./health-intro.component";

describe("HealthIntroComponent", () => {
  let fixture: ComponentFixture<HealthIntroComponent>;
  let theme$: BehaviorSubject<Theme>;

  /** Creates the component with the currently configured theme. */
  function initComponent() {
    fixture = TestBed.createComponent(HealthIntroComponent);
    fixture.detectChanges();
  }

  /** The inline background image applied to the intro card. */
  function backgroundImage(): string {
    return fixture.nativeElement.querySelector("div").style.backgroundImage;
  }

  function scanButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector("button");
  }

  beforeEach(async () => {
    theme$ = new BehaviorSubject<Theme>(ThemeTypes.Light);

    await TestBed.configureTestingModule({
      imports: [HealthIntroComponent],
      providers: [
        { provide: AbstractThemingService, useValue: { theme$ } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();
  });

  describe("theming", () => {
    it("renders the light background image for the light theme", () => {
      initComponent();

      expect(backgroundImage()).toContain("/images/health-tab/health_intro_bg_light.png");
    });

    it("renders the dark background image for the dark theme", () => {
      theme$.next(ThemeTypes.Dark);

      initComponent();

      expect(backgroundImage()).toContain("/images/health-tab/health_intro_bg_dark.png");
    });

    it("renders the light intro image for the light theme", () => {
      initComponent();

      const image = fixture.nativeElement.querySelector("img");

      expect(image.getAttribute("src")).toBe("/images/health-tab/health_intro.png");
    });

    it("renders the dark intro image for the dark theme", () => {
      theme$.next(ThemeTypes.Dark);

      initComponent();

      const image = fixture.nativeElement.querySelector("img");

      expect(image.getAttribute("src")).toBe("/images/health-tab/health_intro_dark.png");
    });

    it("swaps the images when the theme changes", () => {
      initComponent();

      const image = fixture.nativeElement.querySelector("img");

      expect(backgroundImage()).toContain("health_intro_bg_light.png");
      expect(image.getAttribute("src")).toBe("/images/health-tab/health_intro.png");

      theme$.next(ThemeTypes.Dark);
      fixture.detectChanges();

      expect(backgroundImage()).toContain("health_intro_bg_dark.png");
      expect(image.getAttribute("src")).toBe("/images/health-tab/health_intro_dark.png");
    });

    it("falls back to the light background image for a non-dark theme", () => {
      theme$.next(ThemeTypes.System);

      initComponent();

      expect(backgroundImage()).toContain("health_intro_bg_light.png");
    });
  });

  describe("content", () => {
    it("renders the localized copy", () => {
      initComponent();

      const text = fixture.nativeElement.textContent;

      expect(text).toContain("introducingHealth");
      expect(text).toContain("healthIntroDescription");
      expect(text).toContain("scanMyVault");
    });
  });

  describe("scan CTA", () => {
    it("emits onTriggerHealthScan when the button is clicked", () => {
      initComponent();
      const emissions: void[] = [];
      fixture.componentInstance.onTriggerHealthScan.subscribe((value) => emissions.push(value));

      scanButton().click();

      expect(emissions.length).toBe(1);
    });

    it("does not emit onTriggerHealthScan until the button is clicked", () => {
      initComponent();
      const emissions: void[] = [];
      fixture.componentInstance.onTriggerHealthScan.subscribe((value) => emissions.push(value));

      expect(emissions.length).toBe(0);
    });
  });
});
