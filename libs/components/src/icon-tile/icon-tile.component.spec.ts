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

  it("has aria-hidden on icon element", () => {
    const icon = fixture.nativeElement.querySelector("i");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
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
