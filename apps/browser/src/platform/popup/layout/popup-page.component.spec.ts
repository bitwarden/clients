import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { PopupPageComponent } from "./popup-page.component";

/**
 * Stands in for a real slot component (a banner, a callout): its host element is always present,
 * and it decides internally whether to render anything. This is the case a child-element count
 * can't distinguish from real content.
 */
@Component({
  selector: "always-present-host",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (show()) {
    <div style="height: 24px">content</div>
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

/**
 * jsdom reports every element as zero-height and never fires ResizeObserver, so drive the
 * measurement off a stubbed `offsetHeight` and an observer that invokes its callback on demand.
 */
function stubLayout() {
  const callbacks: (() => void)[] = [];

  class FakeResizeObserver {
    constructor(private readonly cb: () => void) {
      callbacks.push(() => this.cb());
    }
    observe() {}
    disconnect() {}
  }

  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;

  return { flushResize: () => callbacks.forEach((cb) => cb()) };
}

describe("PopupPageComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let flushResize: () => void;

  /** The above-scroll-area container — the element whose padding/border is in question. */
  function container(): HTMLElement {
    return fixture.nativeElement.querySelector("always-present-host").parentElement;
  }

  /**
   * Sets the rendered height of the projected host. Deliberately stubs the *child*, not the
   * container: the container is padded even when empty, which is what made a container-level
   * measurement report content that isn't there.
   */
  function setSlotHeight(height: number) {
    const child = fixture.nativeElement.querySelector("always-present-host");
    Object.defineProperty(child, "offsetHeight", { value: height, configurable: true });
  }

  beforeEach(async () => {
    ({ flushResize } = stubLayout());

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it("collapses the above-scroll-area while its only child renders nothing", () => {
    setSlotHeight(0);
    flushResize();
    fixture.detectChanges();

    // The host element is still there — this is exactly what a child count would miss.
    expect(container().childElementCount).toBeGreaterThan(0);
    expect(container().className).toContain("!tw-p-0");
    expect(container().className).toContain("!tw-border-none");
  });

  it("keeps padding and border once the slot renders content", () => {
    setSlotHeight(24);
    flushResize();
    fixture.detectChanges();

    expect(container().className).not.toContain("!tw-p-0");
    expect(container().className).not.toContain("!tw-border-none");
  });

  it("ignores the container's own padding when deciding whether the slot is empty", () => {
    // The real container carries `tw-py-3`, so it reports a non-zero `scrollHeight` even with
    // nothing in it — measuring the container instead of its children keeps it permanently padded.
    Object.defineProperty(container(), "scrollHeight", { value: 40, configurable: true });
    setSlotHeight(0);
    flushResize();
    fixture.detectChanges();

    expect(container().className).toContain("!tw-p-0");
  });

  it("settles instead of oscillating when the container collapses", () => {
    setSlotHeight(0);
    flushResize();
    fixture.detectChanges();
    const collapsed = container().className;

    // A second observation (the one the collapse itself triggers) must not flip it back.
    flushResize();
    fixture.detectChanges();

    expect(container().className).toBe(collapsed);
  });
});
