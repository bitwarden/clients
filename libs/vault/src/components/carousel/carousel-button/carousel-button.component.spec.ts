import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { VaultCarouselSlideComponent } from "../carousel-slide/carousel-slide.component";

import { VaultCarouselButtonComponent } from "./carousel-button.component";

describe("VaultCarouselButtonComponent", () => {
  let fixture: ComponentFixture<VaultCarouselButtonComponent>;
  let component: VaultCarouselButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultCarouselButtonComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VaultCarouselButtonComponent);
    component = fixture.componentInstance;
    component.slide = { label: "Test Label" } as VaultCarouselSlideComponent;

    fixture.detectChanges();
  });

  it("emits click event", () => {
    jest.spyOn(component.onClick, "emit");
    component.button.nativeElement.click();

    expect(component.onClick.emit).toHaveBeenCalled();
  });

  it("focuses on button", () => {
    component.focus();

    expect(document.activeElement).toBe(component.button.nativeElement);
  });

  it('sets the "aria-label" attribute', () => {
    expect(component.button.nativeElement.getAttribute("aria-label")).toBe("Test Label");
  });

  describe("is active", () => {
    beforeEach(() => {
      component.isActive = true;
      fixture.detectChanges();
    });

    it("sets the aria-selected to true", () => {
      expect(component.button.nativeElement.getAttribute("aria-selected")).toBe("true");
    });

    it("adds button to tab index", () => {
      expect(component.button.nativeElement.getAttribute("tabindex")).toBe("0");
    });

    it("shows the active icon", () => {
      expect(
        fixture.debugElement.query(By.css('[data-testid="active-carousel-icon"]')),
      ).not.toBeNull();
      expect(
        fixture.debugElement.query(By.css('[data-testid="inactive-carousel-icon"]')),
      ).toBeNull();
    });
  });

  describe("is not active", () => {
    beforeEach(() => {
      component.isActive = false;
      fixture.detectChanges();
    });

    it("sets the aria-selected to false", () => {
      expect(component.button.nativeElement.getAttribute("aria-selected")).toBe("false");
    });

    it("removes button from tab index", () => {
      expect(component.button.nativeElement.getAttribute("tabindex")).toBe("-1");
    });

    it("shows the inactive icon", () => {
      expect(
        fixture.debugElement.query(By.css('[data-testid="inactive-carousel-icon"]')),
      ).not.toBeNull();
      expect(fixture.debugElement.query(By.css('[data-testid="active-carousel-icon"]'))).toBeNull();
    });
  });
});
