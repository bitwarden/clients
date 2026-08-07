import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AboveScrollAreaDirective } from "./above-scroll-area.directive";
import { PopupPageComponent } from "./popup-page.component";

/**
 * Stands in for a real slot component (a banner, a callout): its host element is always present
 * and it decides internally whether to render anything. Padding the container for this would
 * reserve space even when it shows nothing, which is why the padding moved onto the content.
 */
@Component({
  selector: "always-present-host",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (show()) {
    <div bitAboveScrollArea>content</div>
  }`,
  imports: [AboveScrollAreaDirective],
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

  /** The above-scroll-area container — the element that used to own the padding and border. */
  function container(): HTMLElement {
    return fixture.nativeElement.querySelector("always-present-host").parentElement;
  }

  function slotContent(): HTMLElement | null {
    return fixture.nativeElement.querySelector("[bitAboveScrollArea]");
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
    it("reserves no vertical space when the slot renders nothing", () => {
      // The host element is present but empty — the case that made a container-owned padding
      // leave a visible gap above the scroll area.
      expect(container().childElementCount).toBeGreaterThan(0);
      expect(slotContent()).toBeNull();

      expect(container().className).not.toContain("tw-py-3");
      expect(container().className).not.toContain("tw-border-b");
    });

    it("keeps its horizontal padding, which is safe to apply unconditionally", () => {
      // Centering is a layout concern and costs nothing vertically, so it stays on the container.
      expect(container().className).toContain(
        "tw-px-[max(0.75rem,calc((100%-(var(--tw-sm-breakpoint)))/2))]",
      );
    });

    it("applies vertical padding and the separator to content that renders", () => {
      const host = fixture.debugElement.query(By.directive(AlwaysPresentHostComponent))
        .componentInstance as AlwaysPresentHostComponent;
      host.show.set(true);
      fixture.detectChanges();

      const content = slotContent();
      expect(content).not.toBeNull();
      expect(content!.className).toContain("tw-py-3");
      expect(content!.className).toContain("tw-border-b");
    });
  });
});
