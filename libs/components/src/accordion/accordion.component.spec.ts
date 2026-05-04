import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AccordionComponent } from "./accordion.component";

describe("AccordionComponent", () => {
  let component: AccordionComponent;
  let fixture: ComponentFixture<AccordionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccordionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AccordionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("heading", "Test Heading");
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  describe("default state", () => {
    it("is collapsed by default", () => {
      expect(component.open()).toBe(false);
    });

    it("does not render content panel when collapsed", () => {
      expect(fixture.nativeElement.querySelector(`#${component.contentId}`)).toBeNull();
    });

    it("button has aria-expanded=false when closed", () => {
      expect(fixture.nativeElement.querySelector("button").getAttribute("aria-expanded")).toBe(
        "false",
      );
    });

    it("shows chevron-down icon when collapsed", () => {
      expect(fixture.nativeElement.querySelector("bit-icon").classList).toContain("bwi-angle-down");
    });
  });

  describe("toggle", () => {
    it("opens when button is clicked", () => {
      fixture.nativeElement.querySelector("button").click();
      fixture.detectChanges();
      expect(component.open()).toBe(true);
    });

    it("closes again on second click", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      fixture.nativeElement.querySelector("button").click();
      fixture.detectChanges();
      expect(component.open()).toBe(false);
    });

    it("renders content panel when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(`#${component.contentId}`)).toBeTruthy();
    });

    it("button has aria-expanded=true when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("button").getAttribute("aria-expanded")).toBe(
        "true",
      );
    });

    it("shows chevron-up icon when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("bit-icon").classList).toContain("bwi-angle-up");
    });
  });

  describe("accessibility", () => {
    it("button aria-controls matches content panel id when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector("button");
      const panel = fixture.nativeElement.querySelector(`#${component.contentId}`);
      expect(btn.getAttribute("aria-controls")).toBe(panel.id);
    });

    it("content panel has role=region when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector(`#${component.contentId}`).getAttribute("role"),
      ).toBe("region");
    });

    it("content panel aria-label matches heading when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector(`#${component.contentId}`).getAttribute("aria-label"),
      ).toBe("Test Heading");
    });

    it("chevron icon has aria-hidden=true", () => {
      expect(fixture.nativeElement.querySelector("bit-icon").getAttribute("aria-hidden")).toBe(
        "true",
      );
    });
  });

  describe("disabled", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("disabled", true);
      fixture.detectChanges();
    });

    it("does not toggle when clicked", () => {
      fixture.nativeElement.querySelector("button").click();
      fixture.detectChanges();
      expect(component.open()).toBe(false);
    });

    it("button has disabled attribute", () => {
      expect(fixture.nativeElement.querySelector("button").hasAttribute("disabled")).toBe(true);
    });
  });

  describe("subtitle", () => {
    it("shows subtitle when provided", () => {
      fixture.componentRef.setInput("subtitle", "My subtitle");
      fixture.detectChanges();
      const spans = fixture.nativeElement.querySelectorAll("button span");
      const found = Array.from(spans).some((el: any) => el.textContent.trim() === "My subtitle");
      expect(found).toBe(true);
    });

    it("does not render subtitle span when not provided", () => {
      fixture.detectChanges();
      const spans = fixture.nativeElement.querySelectorAll("button span");
      expect(spans.length).toBe(1);
    });
  });

  describe("host classes", () => {
    it("has tw-rounded-xl", () => {
      expect(fixture.nativeElement.classList).toContain("tw-rounded-xl");
    });

    it("has tw-border", () => {
      expect(fixture.nativeElement.classList).toContain("tw-border");
    });
  });
});
