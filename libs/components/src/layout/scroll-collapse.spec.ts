import { ChangeDetectionStrategy, Component, ElementRef, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CollapseOnScrollDirective } from "./collapse-on-scroll.directive";
import { ScrollCollapseSourceDirective } from "./scroll-collapse-source.directive";
import { ScrollCollapseService } from "./scroll-collapse.service";
import { ScrollLayoutService } from "./scroll-layout.directive";

/**
 * jsdom reports `0` for every layout measurement and never actually scrolls, so the scroll
 * geometry has to be stubbed and the events dispatched by hand.
 */
const stubGeometry = (element: HTMLElement, scrollHeight: number, clientHeight: number) => {
  Object.defineProperty(element, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: clientHeight, configurable: true });
  return element;
};

@Component({
  template: `
    <div bitScrollCollapseSource data-testid="source">
      <div data-testid="sideways">Header</div>
      <div #scroller data-testid="scroller">Rows</div>
    </div>
    <div tabindex="0" data-testid="focus-destination">
      @if (showRegion()) {
        <div [bitCollapseOnScroll]="collapse()" data-testid="region">
          <div>
            <input data-testid="search" />
          </div>
        </div>
      }
    </div>
  `,
  imports: [ScrollCollapseSourceDirective, CollapseOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly collapse = signal(true);
  readonly showRegion = signal(true);
}

describe("scroll collapse", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  const el = (testid: string): HTMLElement =>
    fixture.nativeElement.querySelector(`[data-testid=${testid}]`);
  const region = () => el("region");
  const state = () => region()?.dataset.state;

  /** Scrolls the inner element and lets the animation-frame-scheduled read settle. */
  const scrollTo = async (top: number) => {
    const scroller = el("scroller");
    scroller.scrollTop = top;
    scroller.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();

    // The region stands in for collapsing chrome; give it a height so `minScrollable` is
    // satisfied and scrolling down is actually reported.
    Object.defineProperty(region(), "offsetHeight", { value: 40, configurable: true });
    stubGeometry(el("scroller"), 1000, 500);
  });

  it("starts expanded", () => {
    expect(state()).toBe("expanded");
  });

  it("collapses the region when its source scrolls down", async () => {
    await scrollTo(200);

    expect(state()).toBe("collapsed");
  });

  it("expands the region again when the source scrolls back up", async () => {
    await scrollTo(200);
    expect(state()).toBe("collapsed");

    await scrollTo(150);

    expect(state()).toBe("expanded");
  });

  it("stays expanded when collapsing is disabled", async () => {
    host.collapse.set(false);
    fixture.detectChanges();

    await scrollTo(200);

    expect(state()).toBe("expanded");
  });

  it("keeps the collapsing row able to shrink past its content", () => {
    // Without this the grid item's automatic minimum size holds the row open.
    expect(region().className).toContain("[&>*]:tw-min-h-0");
  });

  describe("focus", () => {
    const search = (): HTMLInputElement => el("search") as HTMLInputElement;

    it("hands focus to the nearest focusable ancestor rather than hiding it", async () => {
      // The vault's search is autofocused on open and keeps focus through a wheel scroll, so
      // without this the region could never collapse.
      search().focus();
      fixture.detectChanges();
      expect(region().contains(document.activeElement)).toBe(true);

      await scrollTo(200);

      expect(document.activeElement).toBe(el("focus-destination"));
      expect(state()).toBe("collapsed");
    });

    it("collapses normally when focus was never inside", async () => {
      await scrollTo(200);

      expect(state()).toBe("collapsed");
    });

    it("leaves focus alone when it sits outside the region", async () => {
      const outside = el("focus-destination");
      outside.focus();

      await scrollTo(200);

      expect(document.activeElement).toBe(outside);
      expect(state()).toBe("collapsed");
    });
  });

  it("zeroes the child's block padding so the row can reach zero height", async () => {
    // Padding sits outside the content box, so `min-height: 0` never reaches it and the
    // track would otherwise stop at the child's padding.
    await scrollTo(200);

    expect(region().className).toContain("[&>*]:!tw-py-0");
  });

  it("only animates the collapse when motion is not reduced", () => {
    expect(region().className).toContain("motion-safe:tw-transition-[grid-template-rows]");
  });

  describe("choosing the scroll source", () => {
    it("ignores a scroller with nothing to scroll vertically", async () => {
      // A table's header row scrolls sideways in step with its body. Adopting it would swap in a
      // vertical range that isn't the one being read, popping the chrome back open.
      const sideways = el("sideways");
      // Taller content than it shows, but clipped vertically — it only scrolls sideways.
      sideways.style.overflowY = "hidden";
      sideways.style.overflowX = "auto";
      stubGeometry(sideways, 400, 40);

      await scrollTo(200);
      expect(state()).toBe("collapsed");

      sideways.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      fixture.detectChanges();

      expect(state()).toBe("collapsed");
    });
  });

  describe("the chrome height that gates the collapse", () => {
    /** Mirrors a consumer collapsing: the scroller takes the height the chrome gives up. */
    const setClientHeight = (element: HTMLElement, clientHeight: number) =>
      Object.defineProperty(element, "clientHeight", { value: clientHeight, configurable: true });

    it("leaves a list that scrolls by less than the chrome alone", async () => {
      // The geometry of the `VaultPageShortScroll` story, and of the CL-1318 report: a 520px popup
      // showing one section header plus seven 59px rows, whose 104px of overflow is less than the
      // 130px of title bar and toolbar that collapsing would hand back. Collapsing would clamp the
      // offset to the top, read as scrolling up, and reopen the chrome.
      Object.defineProperty(region(), "offsetHeight", { value: 130, configurable: true });
      stubGeometry(el("scroller"), 453, 349);

      for (const top of [25, 50, 75, 100, 60, 100]) {
        el("scroller").scrollTop = top;
        el("scroller").dispatchEvent(new Event("scroll"));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        fixture.detectChanges();

        expect(state()).toBe("expanded");
      }
    });

    it("collapses once the list scrolls by more than the chrome", async () => {
      // The same page one row taller, which is all it takes to clear the floor.
      Object.defineProperty(region(), "offsetHeight", { value: 130, configurable: true });
      stubGeometry(el("scroller"), 512, 349);

      await scrollTo(40);

      expect(state()).toBe("collapsed");
    });

    it("keeps counting a collapsed region at its expanded height", async () => {
      // The region's own height animates to nothing, so measuring it live would under-report the
      // floor for the length of that animation and let a collapse through that should be blocked.
      // `settledHeight` holds the expanded value instead.
      const scroller = el("scroller");
      // 30px of overflow can never afford to give back the region's 40px.
      stubGeometry(scroller, 530, 500);

      for (const top of [20, 40, 20, 40]) {
        scroller.scrollTop = top;
        scroller.dispatchEvent(new Event("scroll"));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        fixture.detectChanges();

        if (state() === "collapsed") {
          setClientHeight(scroller, 540);
        }

        expect(state()).toBe("expanded");
      }
    });
  });

  describe("the shared direction signal", () => {
    it("reads the source reported by the capture listener over the layout scroll host", async () => {
      // A page whose content owns its own scroller leaves the layout host with nothing to
      // report, so the reported source has to win.
      const unscrollableHost = stubGeometry(document.createElement("div"), 100, 100);
      TestBed.inject(ScrollLayoutService).scrollableRef.set(new ElementRef(unscrollableHost));

      await scrollTo(200);

      expect(state()).toBe("collapsed");
    });

    it("falls back to the layout scroll host when nothing reports a source", async () => {
      const service = TestBed.inject(ScrollCollapseService);
      const layoutHost = stubGeometry(document.createElement("div"), 1000, 500);
      TestBed.inject(ScrollLayoutService).scrollableRef.set(new ElementRef(layoutHost));
      fixture.detectChanges();

      layoutHost.scrollTop = 200;
      layoutHost.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(service.direction()).toBe("down");
    });

    it("stops counting a region towards the chrome height once it is destroyed", async () => {
      const service = TestBed.inject(ScrollCollapseService);
      host.showRegion.set(false);
      fixture.detectChanges();

      // With no chrome left to collapse, `minScrollable` is 0 and the scroll still reads down.
      await scrollTo(200);

      expect(service.direction()).toBe("down");
    });
  });
});
