import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { PopupPageComponent } from "./popup-page.component";

/**
 * Stands in for a real slot component (a banner, a callout): its host element is always present
 * and it decides internally whether to render anything. Padding the container for this would
 * reserve space even while it shows nothing, which is why the spacing targets non-empty children.
 */
@Component({
  selector: "always-present-host",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (show()) {
    <div>content</div>
  }`,
})
class AlwaysPresentHostComponent {
  readonly show = signal(false);
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PopupPageComponent, AlwaysPresentHostComponent],
  template: `<popup-page>
    <always-present-host slot="above-scroll-area"></always-present-host>
  </popup-page>`,
})
class HostComponent {}

describe("PopupPageComponent", () => {
  let fixture: ComponentFixture<HostComponent>;

  /** The above-scroll-area container, which owns the spacing rules for its children. */
  function container(): HTMLElement {
    return fixture.nativeElement.querySelector("always-present-host").parentElement;
  }

  function setSlotContent(show: boolean) {
    const host = fixture.debugElement.query(By.directive(AlwaysPresentHostComponent))
      .componentInstance as AlwaysPresentHostComponent;
    host.show.set(show);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  describe("above-scroll-area", () => {
    /**
     * The spacing is applied by `>*:not(:empty)`, so what matters is that the container carries
     * the rule and that the projected host is genuinely empty until it renders. jsdom doesn't
     * apply stylesheets, so the selector's effect is asserted through those two facts.
     */
    it("scopes its vertical spacing to non-empty children", () => {
      expect(container().className).toContain("[&>*:not(:empty)]:tw-py-3");
    });

    it("does not put vertical padding on the container itself", () => {
      const ownClasses = container()
        .className.split(/\s+/)
        .filter((c) => !c.includes("[&>"));

      expect(ownClasses).not.toContain("tw-py-3");
    });

    it("leaves an always-present host empty until it renders content", () => {
      // `:empty` is what lets the CSS skip a host that is present but showing nothing — the case
      // a child count can't distinguish from real content.
      const host = fixture.nativeElement.querySelector("always-present-host");
      expect(container().childElementCount).toBeGreaterThan(0);
      expect(host.childElementCount).toBe(0);

      setSlotContent(true);

      expect(host.childElementCount).toBeGreaterThan(0);
    });

    /**
     * The separator marks the boundary being scrolled past, so it belongs to the scroll region
     * rather than to whatever happens to sit above it. Anchoring it to the above-scroll-area's
     * last child meant it vanished whenever that slot was empty — which is the normal case for a
     * presentation that supplies its own header.
     */
    it("puts the scrolled separator on the scroll region, not the slot content", () => {
      const scrollRegion = fixture.nativeElement.querySelector(
        '[data-testid="popup-layout-scroll-region"]',
      ) as HTMLElement;

      expect(scrollRegion.className).toContain("tw-border-t");
      expect(container().className).not.toContain("tw-border-b");
    });

    it("shows the separator while scrolled even when the slot is empty", () => {
      const page = fixture.debugElement.query(By.directive(PopupPageComponent))
        .componentInstance as PopupPageComponent;
      const scrollRegion = fixture.nativeElement.querySelector(
        '[data-testid="popup-layout-scroll-region"]',
      ) as HTMLElement;

      // Nothing projected into the slot — the case that lost the separator entirely.
      expect(fixture.nativeElement.querySelector("always-present-host").childElementCount).toBe(0);

      page["scrolled"].set(true);
      fixture.detectChanges();

      expect(scrollRegion.className).toContain("tw-border-secondary-300");
    });

    it("keeps its horizontal padding, which is safe to apply unconditionally", () => {
      expect(container().className).toContain(
        "tw-px-[max(0.75rem,calc((100%-(var(--tw-sm-breakpoint)))/2))]",
      );
    });
  });
});
