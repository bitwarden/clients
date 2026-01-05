import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DiscountBadgeComponent, DiscountTypes } from "@bitwarden/pricing";

describe("DiscountBadgeComponent", () => {
  let component: DiscountBadgeComponent;
  let fixture: ComponentFixture<DiscountBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscountBadgeComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => key,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscountBadgeComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("display", () => {
    it("should return false when discount is null", () => {
      fixture.componentRef.setInput("discount", null);
      fixture.detectChanges();
      expect(component.display()).toBe(false);
    });

    it("should return false when discount is inactive", () => {
      fixture.componentRef.setInput("discount", {
        type: DiscountTypes.PercentOff,
        active: false,
        value: 20,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(false);
    });

    it("should return true when discount is active with percent-off", () => {
      fixture.componentRef.setInput("discount", {
        type: DiscountTypes.PercentOff,
        active: true,
        value: 20,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(true);
    });

    it("should return true when discount is active with amount-off", () => {
      fixture.componentRef.setInput("discount", {
        type: DiscountTypes.AmountOff,
        active: true,
        value: 10.99,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(true);
    });

    it("should return false when value is 0 (percent-off)", () => {
      fixture.componentRef.setInput("discount", {
        type: DiscountTypes.PercentOff,
        active: true,
        value: 0,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(false);
    });

    it("should return false when value is 0 (amount-off)", () => {
      fixture.componentRef.setInput("discount", {
        type: DiscountTypes.AmountOff,
        active: true,
        value: 0,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(false);
    });
  });

  describe("label", () => {
    it("should return undefined when discount is null", () => {
      fixture.componentRef.setInput("discount", null);
      fixture.detectChanges();
      expect(component.label()).toBeUndefined();
    });

    it("should return percentage text when type is percent-off", () => {
      fixture.componentRef.setInput("discount", {
        type: DiscountTypes.PercentOff,
        active: true,
        value: 20,
      });
      fixture.detectChanges();
      const text = component.label();
      expect(text).toContain("20%");
      expect(text).toContain("discount");
    });

    it("should convert decimal value to percentage for percent-off", () => {
      fixture.componentRef.setInput("discount", {
        type: DiscountTypes.PercentOff,
        active: true,
        value: 0.15,
      });
      fixture.detectChanges();
      const text = component.label();
      expect(text).toContain("15%");
    });

    it("should return amount text when type is amount-off", () => {
      fixture.componentRef.setInput("discount", {
        type: DiscountTypes.AmountOff,
        active: true,
        value: 10.99,
      });
      fixture.detectChanges();
      const text = component.label();
      expect(text).toContain("$10.99");
      expect(text).toContain("discount");
    });
  });
});
