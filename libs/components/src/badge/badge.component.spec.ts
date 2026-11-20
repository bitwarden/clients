import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { TooltipDirective } from "../tooltip/tooltip.directive";

import { BadgeComponent } from "./badge.component";

@Component({
  imports: [BadgeComponent],
  template: `<span bitBadge [truncate]="truncate()" [bitTooltip]="tooltip()">{{ label() }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly label = signal("Personal");
  readonly truncate = signal(true);
  readonly tooltip = signal("");
}

describe("Badge", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let badge: HTMLElement;
  let tooltip: TooltipDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    });

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();

    const badgeDebugElement = fixture.debugElement.query(By.directive(BadgeComponent));
    badge = badgeDebugElement.nativeElement;
    tooltip = badgeDebugElement.injector.get(TooltipDirective);

    // These tests cover what content the badge hands the tooltip, not whether the overlay
    // displays. Suppressing keeps hovering from building a CDK overlay, whose stylesheet jsdom
    // cannot parse.
    tooltip.suppressed.set(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  const hover = () => badge.dispatchEvent(new MouseEvent("mouseenter"));

  describe("default tooltip content", () => {
    it("uses the badge's text", () => {
      hover();

      expect(tooltip.tooltipContent()).toBe("Personal");
    });

    it("re-reads the badge's text when it changes", () => {
      hover();
      expect(tooltip.tooltipContent()).toBe("Personal");

      host.label.set("Work");
      fixture.detectChanges();
      hover();

      expect(tooltip.tooltipContent()).toBe("Work");
    });

    it("is empty when the badge does not truncate", () => {
      host.truncate.set(false);
      fixture.detectChanges();
      hover();

      expect(tooltip.tooltipContent()).toBe("");
    });

    it("is re-read on keyboard focus", () => {
      host.label.set("Work");
      fixture.detectChanges();
      badge.dispatchEvent(new FocusEvent("focusin"));

      expect(tooltip.tooltipContent()).toBe("Work");
    });
  });

  describe("consumer-provided tooltip content", () => {
    it("is not overwritten by the badge's text", () => {
      host.tooltip.set("Custom content");
      fixture.detectChanges();
      hover();

      expect(tooltip.tooltipContent()).toBe("Custom content");
    });

    it("is not overwritten once the badge has already set its own content", () => {
      hover();
      expect(tooltip.tooltipContent()).toBe("Personal");

      host.tooltip.set("Custom content");
      host.label.set("Work");
      fixture.detectChanges();
      hover();

      expect(tooltip.tooltipContent()).toBe("Custom content");
    });
  });
});
