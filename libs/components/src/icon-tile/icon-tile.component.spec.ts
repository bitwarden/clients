import { ComponentFixture, TestBed } from "@angular/core/testing";

import { IconTileComponent } from "./icon-tile.component";

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

  it("has default inputs", () => {
    expect(component.variant()).toBe("primary");
    expect(component.size()).toBe("base");
    expect(component.shape()).toBe("square");
    expect(component.ariaLabel()).toBeUndefined();
  });

  describe("variants", () => {
    it("applies primary variant classes", () => {
      fixture.componentRef.setInput("variant", "primary");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-bg-bg-brand-soft")).toBe(true);
      expect(container.classList.contains("tw-border-border-brand-soft")).toBe(true);
      expect(container.classList.contains("tw-text-fg-brand")).toBe(true);
    });

    it("applies success variant classes", () => {
      fixture.componentRef.setInput("variant", "success");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-bg-bg-success-medium")).toBe(true);
      expect(container.classList.contains("tw-border-border-success-soft")).toBe(true);
      expect(container.classList.contains("tw-text-fg-success")).toBe(true);
    });

    it("applies danger variant classes", () => {
      fixture.componentRef.setInput("variant", "danger");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-bg-bg-danger-medium")).toBe(true);
      expect(container.classList.contains("tw-border-border-danger-soft")).toBe(true);
      expect(container.classList.contains("tw-text-fg-danger")).toBe(true);
    });

    it("applies warning variant classes", () => {
      fixture.componentRef.setInput("variant", "warning");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-bg-bg-warning-medium")).toBe(true);
      expect(container.classList.contains("tw-border-border-warning-soft")).toBe(true);
      expect(container.classList.contains("tw-text-fg-warning")).toBe(true);
    });

    it("applies subtle variant classes", () => {
      fixture.componentRef.setInput("variant", "subtle");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-bg-bg-quaternary")).toBe(true);
      expect(container.classList.contains("tw-border-border-base")).toBe(true);
      expect(container.classList.contains("tw-text-fg-body")).toBe(true);
    });

    it("applies dark variant classes", () => {
      fixture.componentRef.setInput("variant", "dark");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-bg-bg-contrast")).toBe(true);
      expect(container.classList.contains("tw-border-border-strong")).toBe(true);
      expect(container.classList.contains("tw-text-fg-contrast")).toBe(true);
    });

    it("applies contrast variant classes", () => {
      fixture.componentRef.setInput("variant", "contrast");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-bg-bg-primary")).toBe(true);
      expect(container.classList.contains("tw-border-border-base")).toBe(true);
      expect(container.classList.contains("tw-text-fg-dark")).toBe(true);
    });
  });

  describe("sizes", () => {
    it("applies xs size classes", () => {
      fixture.componentRef.setInput("size", "xs");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      const icon = container.querySelector("i");

      expect(container.classList.contains("tw-w-4")).toBe(true);
      expect(container.classList.contains("tw-h-4")).toBe(true);
      expect(icon.classList.contains("tw-text-xs")).toBe(true);
      expect(icon.classList.contains("tw-leading-[0]")).toBe(true);
    });

    it("applies sm size classes", () => {
      fixture.componentRef.setInput("size", "sm");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      const icon = container.querySelector("i");

      expect(container.classList.contains("tw-w-6")).toBe(true);
      expect(container.classList.contains("tw-h-6")).toBe(true);
      expect(icon.classList.contains("tw-text-sm")).toBe(true);
      expect(icon.classList.contains("tw-leading-[0]")).toBe(true);
    });

    it("applies base size classes", () => {
      fixture.componentRef.setInput("size", "base");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      const icon = container.querySelector("i");

      expect(container.classList.contains("tw-w-9")).toBe(true);
      expect(container.classList.contains("tw-h-9")).toBe(true);
      expect(icon.classList.contains("tw-text-lg")).toBe(true);
    });

    it("applies lg size classes", () => {
      fixture.componentRef.setInput("size", "lg");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      const icon = container.querySelector("i");

      expect(container.classList.contains("tw-w-12")).toBe(true);
      expect(container.classList.contains("tw-h-12")).toBe(true);
      expect(icon.classList.contains("tw-text-2xl")).toBe(true);
    });

    it("applies xl size classes", () => {
      fixture.componentRef.setInput("size", "xl");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      const icon = container.querySelector("i");

      expect(container.classList.contains("tw-w-16")).toBe(true);
      expect(container.classList.contains("tw-h-16")).toBe(true);
      expect(icon.classList.contains("tw-text-3xl")).toBe(true);
    });
  });

  describe("shapes", () => {
    it("applies square shape with xs border-radius", () => {
      fixture.componentRef.setInput("shape", "square");
      fixture.componentRef.setInput("size", "xs");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-rounded")).toBe(true);
    });

    it("applies square shape with sm border-radius", () => {
      fixture.componentRef.setInput("shape", "square");
      fixture.componentRef.setInput("size", "sm");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-rounded")).toBe(true);
    });

    it("applies square shape with base border-radius", () => {
      fixture.componentRef.setInput("shape", "square");
      fixture.componentRef.setInput("size", "base");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-rounded-lg")).toBe(true);
    });

    it("applies square shape with lg border-radius", () => {
      fixture.componentRef.setInput("shape", "square");
      fixture.componentRef.setInput("size", "lg");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-rounded-lg")).toBe(true);
    });

    it("applies square shape with xl border-radius", () => {
      fixture.componentRef.setInput("shape", "square");
      fixture.componentRef.setInput("size", "xl");
      fixture.detectChanges();

      const container = fixture.nativeElement.children[0];
      expect(container.classList.contains("tw-rounded-xl")).toBe(true);
    });

    it("applies circle shape for all sizes", () => {
      const sizes = ["xs", "sm", "base", "lg", "xl"];

      sizes.forEach((size) => {
        fixture.componentRef.setInput("shape", "circle");
        fixture.componentRef.setInput("size", size);
        fixture.detectChanges();

        const container = fixture.nativeElement.children[0];
        expect(container.classList.contains("tw-rounded-full")).toBe(true);
      });
    });
  });

  describe("icon classes", () => {
    it("applies icon classes", () => {
      fixture.componentRef.setInput("icon", "bwi-collection");
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector("i");
      expect(icon.classList.contains("bwi")).toBe(true);
      expect(icon.classList.contains("bwi-collection")).toBe(true);
    });

    it("updates icon when input changes", () => {
      fixture.componentRef.setInput("icon", "bwi-user");
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector("i");
      expect(icon.classList.contains("bwi-user")).toBe(true);
    });

    it("has aria-hidden on icon element", () => {
      const icon = fixture.nativeElement.querySelector("i");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("container classes", () => {
    it("applies base container classes", () => {
      const container = fixture.nativeElement.children[0];

      expect(container.classList.contains("tw-inline-flex")).toBe(true);
      expect(container.classList.contains("tw-items-center")).toBe(true);
      expect(container.classList.contains("tw-justify-center")).toBe(true);
      expect(container.classList.contains("tw-flex-shrink-0")).toBe(true);
      expect(container.classList.contains("tw-border")).toBe(true);
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
