import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { SpinnerComponent } from "./spinner.component";

describe("SpinnerComponent", () => {
  let component: SpinnerComponent;
  let fixture: ComponentFixture<SpinnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpinnerComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ loading: "Loading" }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("Render Tests", () => {
    it("create", () => {
      expect(component).toBeTruthy();
    });

    it("render with default variant (primary)", () => {
      const svg = fixture.nativeElement.querySelector("svg");
      const foregroundCircle = svg.querySelectorAll("circle")[1];

      expect(foregroundCircle.classList.contains("tw-stroke-bg-brand")).toBe(true);
    });

    it("render SVG with correct structure", () => {
      const svg = fixture.nativeElement.querySelector("svg");

      expect(svg).toBeTruthy();
      expect(svg.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
      expect(svg.getAttribute("viewBox")).toBe("0 0 56 56");
      expect(svg.classList.contains("tw-animate-spin")).toBe(true);
    });
  });

  describe("Accessibility Tests", () => {
    it("have default title from i18n service", () => {
      expect(component.title()).toBe("Loading");
    });

    it("accept custom title input", () => {
      fixture.componentRef.setInput("title", "Processing");
      fixture.detectChanges();

      expect(component.title()).toBe("Processing");
    });

    it("set aria-label when title is provided", () => {
      fixture.componentRef.setInput("title", "Loading data");
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector("svg");
      expect(svg.getAttribute("aria-label")).toBe("Loading data");
    });

    it("set aria-hidden to true when title is provided", () => {
      fixture.componentRef.setInput("title", "Loading");
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector("svg");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });

    it("handle empty title", () => {
      fixture.componentRef.setInput("title", "");
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector("svg");
      expect(svg.getAttribute("aria-label")).toBeFalsy();
      expect(svg.getAttribute("aria-hidden")).toBeFalsy();
    });
  });
});
