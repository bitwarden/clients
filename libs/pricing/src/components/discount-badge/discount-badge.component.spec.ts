import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DiscountBadgeComponent } from "./discount-badge.component";

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

  describe("hasDiscount", () => {
    it("should return false when discount is null", () => {
      fixture.componentRef.setInput("discount", null);
      fixture.detectChanges();
      expect(component.hasDiscount()).toBe(false);
    });

    it("should return false when discount is inactive", () => {
      fixture.componentRef.setInput("discount", { active: false, percentOff: 20 });
      fixture.detectChanges();
      expect(component.hasDiscount()).toBe(false);
    });

    it("should return true when discount is active with percentOff", () => {
      fixture.componentRef.setInput("discount", { active: true, percentOff: 20 });
      fixture.detectChanges();
      expect(component.hasDiscount()).toBe(true);
    });

    it("should return true when discount is active with amountOff", () => {
      fixture.componentRef.setInput("discount", { active: true, amountOff: 10.99 });
      fixture.detectChanges();
      expect(component.hasDiscount()).toBe(true);
    });

    it("should return false when percentOff is 0", () => {
      fixture.componentRef.setInput("discount", { active: true, percentOff: 0 });
      fixture.detectChanges();
      expect(component.hasDiscount()).toBe(false);
    });

    it("should return false when amountOff is 0", () => {
      fixture.componentRef.setInput("discount", { active: true, amountOff: 0 });
      fixture.detectChanges();
      expect(component.hasDiscount()).toBe(false);
    });
  });

  describe("getDiscountText", () => {
    it("should return null when discount is null", () => {
      fixture.componentRef.setInput("discount", null);
      fixture.detectChanges();
      expect(component.getDiscountText()).toBeNull();
    });

    it("should return percentage text when percentOff is provided", () => {
      fixture.componentRef.setInput("discount", { active: true, percentOff: 20 });
      fixture.detectChanges();
      const text = component.getDiscountText();
      expect(text).toContain("20%");
      expect(text).toContain("discount");
    });

    it("should convert decimal percentOff to percentage", () => {
      fixture.componentRef.setInput("discount", { active: true, percentOff: 0.15 });
      fixture.detectChanges();
      const text = component.getDiscountText();
      expect(text).toContain("15%");
    });

    it("should return amount text when amountOff is provided", () => {
      fixture.componentRef.setInput("discount", { active: true, amountOff: 10.99 });
      fixture.detectChanges();
      const text = component.getDiscountText();
      expect(text).toContain("$10.99");
      expect(text).toContain("discount");
    });

    it("should prefer percentOff over amountOff", () => {
      fixture.componentRef.setInput("discount", { active: true, percentOff: 25, amountOff: 10.99 });
      fixture.detectChanges();
      const text = component.getDiscountText();
      expect(text).toContain("25%");
      expect(text).not.toContain("$10.99");
    });
  });
});
