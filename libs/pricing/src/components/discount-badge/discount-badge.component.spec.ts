import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DiscountBadgeComponent } from "@bitwarden/pricing";

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
    it("should return false when discount is inactive", () => {
      fixture.componentRef.setInput("discount", {
        active: false,
        _tag: "percent-off",
        value: 20,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(false);
    });

    it("should return true when discount is active with percent-off", () => {
      fixture.componentRef.setInput("discount", {
        active: true,
        _tag: "percent-off",
        value: 20,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(true);
    });

    it("should return true when discount is active with amount-off", () => {
      fixture.componentRef.setInput("discount", {
        active: true,
        _tag: "amount-off",
        value: 10.99,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(true);
    });

    it("should return false when percent-off value is 0", () => {
      fixture.componentRef.setInput("discount", {
        active: true,
        _tag: "percent-off",
        value: 0,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(false);
    });

    it("should return false when amount-off value is 0", () => {
      fixture.componentRef.setInput("discount", {
        active: true,
        _tag: "amount-off",
        value: 0,
      });
      fixture.detectChanges();
      expect(component.display()).toBe(false);
    });
  });

  describe("text", () => {
    it("should return percentage text when percent-off is provided", () => {
      fixture.componentRef.setInput("discount", {
        active: true,
        _tag: "percent-off",
        value: 20,
      });
      fixture.detectChanges();
      const text = component.text();
      expect(text).toContain("20%");
      expect(text).toContain("discount");
    });

    it("should convert decimal percent-off to percentage", () => {
      fixture.componentRef.setInput("discount", {
        active: true,
        _tag: "percent-off",
        value: 0.15,
      });
      fixture.detectChanges();
      const text = component.text();
      expect(text).toContain("15%");
    });

    it("should return amount text when amount-off is provided", () => {
      fixture.componentRef.setInput("discount", {
        active: true,
        _tag: "amount-off",
        value: 10.99,
      });
      fixture.detectChanges();
      const text = component.text();
      expect(text).toContain("$10.99");
      expect(text).toContain("discount");
    });
  });
});
