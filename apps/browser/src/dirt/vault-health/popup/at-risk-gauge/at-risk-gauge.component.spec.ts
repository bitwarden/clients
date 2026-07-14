import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { AtRiskGaugeComponent } from "./at-risk-gauge.component";

describe("AtRiskGaugeComponent", () => {
  let component: AtRiskGaugeComponent;
  let fixture: ComponentFixture<AtRiskGaugeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AtRiskGaugeComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ atRisk: "at risk" }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AtRiskGaugeComponent);
    component = fixture.componentInstance;
  });

  /** Access protected computed signals for assertions without widening their visibility. */
  const read = () =>
    component as unknown as {
      fillFraction: () => number;
      percentage: () => number;
      isAtRisk: () => boolean;
      strokeDashoffset: () => number;
      trackStrokeClass: () => string;
      accessibleValueText: () => string;
    };

  const setInputs = (value: number, total: number) => {
    fixture.componentRef.setInput("value", value);
    fixture.componentRef.setInput("total", total);
    fixture.detectChanges();
  };

  describe("fill proportion", () => {
    it("renders empty (0 fill) when value is 0", () => {
      setInputs(0, 100);
      expect(read().fillFraction()).toBe(0);
      expect(read().percentage()).toBe(0);
      expect(read().strokeDashoffset()).toBe(100);
    });

    it("renders half full when value is half of total", () => {
      setInputs(50, 100);
      expect(read().fillFraction()).toBe(0.5);
      expect(read().percentage()).toBe(50);
      expect(read().strokeDashoffset()).toBe(50);
    });

    it("renders full when value equals total", () => {
      setInputs(100, 100);
      expect(read().fillFraction()).toBe(1);
      expect(read().percentage()).toBe(100);
      expect(read().strokeDashoffset()).toBe(0);
    });

    it("clamps fill and percentage when value exceeds total", () => {
      setInputs(150, 100);
      expect(read().fillFraction()).toBe(1);
      expect(read().strokeDashoffset()).toBe(0);
      expect(read().percentage()).toBe(100);
    });

    it("rounds the displayed percentage", () => {
      setInputs(1, 3);
      expect(read().percentage()).toBe(33);
      expect(read().fillFraction()).toBeCloseTo(1 / 3);
    });
  });

  describe("color state", () => {
    it("is green (not at risk) when value is 0", () => {
      setInputs(0, 100);
      expect(read().isAtRisk()).toBe(false);
      expect(read().trackStrokeClass()).toContain("success");
    });

    it("is red (at risk) when value is greater than 0", () => {
      setInputs(1, 100);
      expect(read().isAtRisk()).toBe(true);
      expect(read().trackStrokeClass()).toContain("quaternary");
    });
  });

  describe("total-of-0 edge case", () => {
    it("renders empty and green without error when total is 0", () => {
      expect(() => setInputs(0, 0)).not.toThrow();
      expect(read().fillFraction()).toBe(0);
      expect(read().percentage()).toBe(0);
      expect(read().isAtRisk()).toBe(false);
      expect(read().trackStrokeClass()).toContain("success");
    });

    it("treats a positive value with a 0 total as empty (no divide-by-zero)", () => {
      setInputs(5, 0);
      expect(read().fillFraction()).toBe(0);
      expect(read().percentage()).toBe(0);
      expect(read().isAtRisk()).toBe(false);
    });
  });

  describe("rendering", () => {
    it("shows the percentage and the at-risk label in the DOM", () => {
      setInputs(37, 100);
      const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
      expect(text).toContain("37%");
      expect(text).toContain("at risk");
    });

    it("builds a localized accessible value text from the i18n label", () => {
      setInputs(37, 100);
      expect(read().accessibleValueText()).toBe("37% at risk");
    });

    it("exposes progressbar semantics on a 0-100 scale", () => {
      setInputs(37, 100);
      const bar = (fixture.nativeElement as HTMLElement).querySelector('[role="progressbar"]');
      expect(bar?.getAttribute("aria-valuemin")).toBe("0");
      expect(bar?.getAttribute("aria-valuemax")).toBe("100");
      expect(bar?.getAttribute("aria-valuenow")).toBe("37");
      expect(bar?.getAttribute("aria-valuetext")).toBe("37% at risk");
    });
  });
});
