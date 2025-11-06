import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DiscountBadgeComponent } from "./discount-badge.component";

describe("DiscountBadgeComponent", () => {
  let component: DiscountBadgeComponent;
  let fixture: ComponentFixture<DiscountBadgeComponent>;
  let i18nService: I18nService;

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
    i18nService = TestBed.inject(I18nService);
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("hasDiscount", () => {
    it("should return false when discount is null", () => {
      component.discount.set(null);
      expect(component.hasDiscount()).toBe(false);
    });

    it("should return false when discount is inactive", () => {
      component.discount.set({ active: false, percentOff: 20 });
      expect(component.hasDiscount()).toBe(false);
    });

    it("should return true when discount is active with percentOff", () => {
      component.discount.set({ active: true, percentOff: 20 });
      expect(component.hasDiscount()).toBe(true);
    });

    it("should return true when discount is active with amountOff", () => {
      component.discount.set({ active: true, amountOff: 10.99 });
      expect(component.hasDiscount()).toBe(true);
    });

    it("should return false when percentOff is 0", () => {
      component.discount.set({ active: true, percentOff: 0 });
      expect(component.hasDiscount()).toBe(false);
    });

    it("should return false when amountOff is 0", () => {
      component.discount.set({ active: true, amountOff: 0 });
      expect(component.hasDiscount()).toBe(false);
    });
  });

  describe("getDiscountText", () => {
    it("should return null when discount is null", () => {
      component.discount.set(null);
      expect(component.getDiscountText()).toBeNull();
    });

    it("should return percentage text when percentOff is provided", () => {
      component.discount.set({ active: true, percentOff: 20 });
      const text = component.getDiscountText();
      expect(text).toContain("20%");
      expect(text).toContain("discount");
    });

    it("should convert decimal percentOff to percentage", () => {
      component.discount.set({ active: true, percentOff: 0.15 });
      const text = component.getDiscountText();
      expect(text).toContain("15%");
    });

    it("should return amount text when amountOff is provided", () => {
      component.discount.set({ active: true, amountOff: 10.99 });
      const text = component.getDiscountText();
      expect(text).toContain("$10.99");
      expect(text).toContain("discount");
    });

    it("should prefer percentOff over amountOff", () => {
      component.discount.set({ active: true, percentOff: 25, amountOff: 10.99 });
      const text = component.getDiscountText();
      expect(text).toContain("25%");
      expect(text).not.toContain("$10.99");
    });
  });
});
