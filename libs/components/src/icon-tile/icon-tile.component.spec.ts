import { ComponentFixture, TestBed } from "@angular/core/testing";

import { IconTileComponent } from "./icon-tile.component";

// Reach the protected computed signal for assertions that jsdom's CSS parser can't verify.
const colorStyles = (component: IconTileComponent) =>
  (
    component as unknown as {
      colorStyles: () => { background: string; border: string; text: string };
    }
  ).colorStyles();

describe("IconTileComponent", () => {
  let component: IconTileComponent;
  let fixture: ComponentFixture<IconTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconTileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconTileComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("icon", "bwi-star");
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  it("has aria-hidden on icon element", () => {
    const icon = fixture.nativeElement.querySelector("i");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  describe("variant colors", () => {
    it("applies the default variant's decorative CSS variables as inline styles", () => {
      // Default variant is `primary`, which renders as the brand family at subtle emphasis.
      expect(colorStyles(component)).toEqual({
        background: "var(--color-bg-decorative-brand)",
        border: "var(--color-border-decorative-brand)",
        text: "var(--color-fg-decorative-brand)",
      });
    });

    it("responds to emphasis for decorative families", () => {
      fixture.componentRef.setInput("variant", "teal");
      fixture.componentRef.setInput("emphasis", "bold");
      fixture.detectChanges();

      expect(colorStyles(component)).toEqual({
        background: "var(--color-bg-decorative-teal-bold)",
        border: "var(--color-border-decorative-teal-bold)",
        text: "var(--color-fg-decorative-teal-bold)",
      });
    });

    it("ignores emphasis for semantic alias variants", () => {
      fixture.componentRef.setInput("variant", "primary");
      fixture.componentRef.setInput("emphasis", "bold");
      fixture.detectChanges();

      // `primary` aliases the brand family and always renders subtle, regardless of emphasis.
      expect(colorStyles(component)).toEqual({
        background: "var(--color-bg-decorative-brand)",
        border: "var(--color-border-decorative-brand)",
        text: "var(--color-fg-decorative-brand)",
      });
    });
  });

  describe("custom color", () => {
    it("applies the custom color as fill, overriding the variant tokens", () => {
      fixture.componentRef.setInput("color", "#175ddc");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0] as HTMLElement;
      expect(container.style.backgroundColor).toBe("rgb(23, 93, 220)");
      // border width class is still applied
      expect(container.className).toContain("tw-border");
    });

    it("uses white foreground and a lightened border for a dark custom color", () => {
      fixture.componentRef.setInput("color", "#175ddc");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0] as HTMLElement;
      expect(container.style.color).toBe("white");
      // Asserted via the signal — jsdom's CSS parser does not understand the relative-color syntax.
      expect(colorStyles(component).border).toBe("hsl(from #175ddc h s calc(l + 15))");
    });

    it("uses dark foreground and a darkened border for a light custom color", () => {
      fixture.componentRef.setInput("color", "#f8e71c");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0] as HTMLElement;
      expect(container.style.color).toBe("black");
      expect(colorStyles(component).border).toBe("hsl(from #f8e71c h s calc(l - 15))");
    });
  });

  describe("accessibility", () => {
    it("sets aria-label and role when ariaLabel is provided", () => {
      fixture.componentRef.setInput("ariaLabel", "Success indicator");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.getAttribute("aria-label")).toBe("Success indicator");
      expect(container.getAttribute("role")).toBe("img");
    });

    it("does not set role when ariaLabel is not provided", () => {
      const container = fixture.nativeElement.children[0];
      expect(container.getAttribute("aria-label")).toBeNull();
      expect(container.getAttribute("role")).toBeNull();
    });

    it("updates aria-label when input changes", () => {
      fixture.componentRef.setInput("ariaLabel", "Initial label");
      fixture.detectChanges();

      let container = fixture.nativeElement.children[0];
      expect(container.getAttribute("aria-label")).toBe("Initial label");

      fixture.componentRef.setInput("ariaLabel", "Updated label");
      fixture.detectChanges();

      container = fixture.nativeElement.children[0];
      expect(container.getAttribute("aria-label")).toBe("Updated label");
    });
  });
});
