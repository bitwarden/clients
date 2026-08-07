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
      expect(container().className).toContain("[&>*:not(:empty)]:tw-border-b");
    });

    it("does not put vertical padding or a border on the container itself", () => {
      const ownClasses = container()
        .className.split(/\s+/)
        .filter((c) => !c.includes("[&>"));

      expect(ownClasses).not.toContain("tw-py-3");
      expect(ownClasses).not.toContain("tw-border-b");
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

    it("keeps its horizontal padding, which is safe to apply unconditionally", () => {
      expect(container().className).toContain(
        "tw-px-[max(0.75rem,calc((100%-(var(--tw-sm-breakpoint)))/2))]",
      );
    });
  });
});
