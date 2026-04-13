import { ComponentFixture, TestBed } from "@angular/core/testing";

import { BadgeComponent } from "./badge.component";

describe("BadgeComponent", () => {
  let component: BadgeComponent;
  let fixture: ComponentFixture<BadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  describe("focusability", () => {
    it("has tabindex=0 when badge has title content (truncated text)", () => {
      fixture.componentRef.setInput("title", "My badge label");
      fixture.detectChanges();

      const host: HTMLElement = fixture.nativeElement;
      expect(host.getAttribute("tabindex")).toBe("0");
    });

    it("does not have tabindex when truncate is false", () => {
      fixture.componentRef.setInput("truncate", false);
      fixture.detectChanges();

      const host: HTMLElement = fixture.nativeElement;
      expect(host.getAttribute("tabindex")).toBeNull();
    });
  });

  describe("VoiceOver / screen reader", () => {
    it("uses a span (not div) as the inner wrapper to preserve inline reading flow", () => {
      const host: HTMLElement = fixture.nativeElement;
      const wrapper = host.firstElementChild as HTMLElement;
      expect(wrapper.tagName.toLowerCase()).toBe("span");
    });

    it("does not set aria-label when ariaLabel input is not provided", () => {
      const host: HTMLElement = fixture.nativeElement;
      expect(host.getAttribute("aria-label")).toBeNull();
    });

    it("sets aria-label on the host when ariaLabel input is provided", () => {
      fixture.componentRef.setInput("ariaLabel", "5 unread notifications");
      fixture.detectChanges();

      const host: HTMLElement = fixture.nativeElement;
      expect(host.getAttribute("aria-label")).toBe("5 unread notifications");
    });

    it("updates aria-label when ariaLabel input changes", () => {
      fixture.componentRef.setInput("ariaLabel", "Initial label");
      fixture.detectChanges();
      expect(fixture.nativeElement.getAttribute("aria-label")).toBe("Initial label");

      fixture.componentRef.setInput("ariaLabel", "Updated label");
      fixture.detectChanges();
      expect(fixture.nativeElement.getAttribute("aria-label")).toBe("Updated label");
    });
  });
});
