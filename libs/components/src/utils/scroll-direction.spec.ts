import { ElementRef, Signal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ScrollDirection, scrollDirection } from "./scroll-direction";

/**
 * jsdom reports `0` for every layout measurement, so the scroll geometry has to be stubbed for the
 * element to look scrollable at all.
 */
const createScrollable = (scrollHeight = 1000, clientHeight = 500) => {
  const element = document.createElement("div");

  Object.defineProperty(element, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: clientHeight, configurable: true });

  return element;
};

/** Flushes `auditTime(0, animationFrameScheduler)`. */
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const scrollTo = async (element: HTMLElement, top: number) => {
  element.scrollTop = top;
  element.dispatchEvent(new Event("scroll"));

  await nextFrame();
};

describe("scrollDirection", () => {
  const create = (
    scrollable: Signal<ElementRef<HTMLElement> | HTMLElement | null>,
    options?: Parameters<typeof scrollDirection>[1],
  ): Signal<ScrollDirection> =>
    TestBed.runInInjectionContext(() => scrollDirection(scrollable, options));

  it("starts out scrolling up", () => {
    expect(create(signal(createScrollable()))()).toBe("up");
  });

  it("accepts an ElementRef", async () => {
    const element = createScrollable();
    const direction = create(signal(new ElementRef(element)));

    await scrollTo(element, 200);

    expect(direction()).toBe("down");
  });

  it("reports up while there is no element", async () => {
    const scrollable = signal<HTMLElement | null>(null);
    const direction = create(scrollable);

    await nextFrame();
    expect(direction()).toBe("up");

    const element = createScrollable();
    scrollable.set(element);
    await scrollTo(element, 200);

    expect(direction()).toBe("down");
  });

  it("reports up when the element cannot scroll", async () => {
    const element = createScrollable(500, 500);
    const direction = create(signal(element));

    await scrollTo(element, 200);

    expect(direction()).toBe("up");
  });

  it("reports down once the threshold is passed", async () => {
    const element = createScrollable();
    const direction = create(signal(element), { threshold: 16 });

    await scrollTo(element, 17);

    expect(direction()).toBe("down");
  });

  it("holds direction below the threshold", async () => {
    const element = createScrollable();
    const direction = create(signal(element), { threshold: 16 });

    await scrollTo(element, 8);

    expect(direction()).toBe("up");
  });

  it("ignores jitter that alternates below the threshold", async () => {
    const element = createScrollable();
    const direction = create(signal(element), { threshold: 16 });

    for (const top of [8, 1, 9, 2, 10, 3]) {
      await scrollTo(element, top);
      expect(direction()).toBe("up");
    }
  });

  it("flips once sub-threshold steps accumulate past the threshold", async () => {
    const element = createScrollable();
    const direction = create(signal(element), { threshold: 16 });

    await scrollTo(element, 8);
    expect(direction()).toBe("up");

    await scrollTo(element, 16);
    expect(direction()).toBe("up");

    await scrollTo(element, 24);
    expect(direction()).toBe("down");
  });

  it("reports up again when scrolling back up past the threshold", async () => {
    const element = createScrollable();
    const direction = create(signal(element), { threshold: 16 });

    await scrollTo(element, 200);
    expect(direction()).toBe("down");

    await scrollTo(element, 150);
    expect(direction()).toBe("up");
  });

  it("reports up at the top of the element", async () => {
    const element = createScrollable();
    const direction = create(signal(element));

    await scrollTo(element, 200);
    expect(direction()).toBe("down");

    await scrollTo(element, 0);
    expect(direction()).toBe("up");
  });

  it("holds down near the bottom, where collapsing chrome clamps the offset", async () => {
    const element = createScrollable();
    const direction = create(signal(element), { bottomOffset: 24 });

    // maxTop is 500, so anything at or past 476 is "near the bottom".
    await scrollTo(element, 500);
    expect(direction()).toBe("down");

    // The consumer collapsed its header, the viewport grew, and the browser clamped `scrollTop`.
    await scrollTo(element, 480);
    expect(direction()).toBe("down");
  });

  describe("minScrollable", () => {
    /**
     * Redefinable because collapsing chrome hands its height back to the scroll region, which is
     * the whole reason a floor is needed.
     */
    const setClientHeight = (element: HTMLElement, clientHeight: number) =>
      Object.defineProperty(element, "clientHeight", { value: clientHeight, configurable: true });

    it("holds up when the region cannot outscroll the chrome a consumer would collapse", async () => {
      // 40px of overflow against a 48px title bar: collapsing it would leave nothing to scroll, so
      // the browser would clamp the offset back to the top and the bar would expand again.
      const element = createScrollable(540, 500);
      const direction = create(signal(element), { minScrollable: 48 });

      await scrollTo(element, 30);
      expect(direction()).toBe("up");
    });

    it("flips once the region can outscroll that chrome", async () => {
      const element = createScrollable(600, 500);
      const direction = create(signal(element), { minScrollable: 48 });

      await scrollTo(element, 30);
      expect(direction()).toBe("down");
    });

    it("holds down after the collapse shrinks maxTop past the floor", async () => {
      const element = createScrollable(560, 500);
      const direction = create(signal(element), { minScrollable: 48 });

      // maxTop is 60, which clears the floor, so the consumer collapses its chrome.
      await scrollTo(element, 55);
      expect(direction()).toBe("down");

      // That hands 48px back to the scroll region, leaving 12px of overflow and clamping the
      // offset. Re-testing the floor here would expand the chrome and start the cycle over.
      setClientHeight(element, 548);
      await scrollTo(element, 12);
      expect(direction()).toBe("down");
    });

    it("holds up when the region can scroll exactly as far as the chrome is tall", async () => {
      // The boundary the gate's `<=` is written for: handing back exactly `maxTop` leaves nothing
      // to scroll, so this has to fail closed.
      const element = createScrollable(548, 500);
      const direction = create(signal(element), { minScrollable: 48 });

      await scrollTo(element, 30);

      expect(direction()).toBe("up");
    });

    it("does not flap when a collapse clamps the offset back to the top", async () => {
      // The CL-1318 loop, driven end to end: a page with less overflow than the chrome it would
      // collapse. `clientHeight` and the floor move together, the way they do when the chrome
      // actually animates — the collapse hands its height to the scroller.
      const chrome = 48;
      const element = createScrollable(530, 500);
      let collapsed = false;
      const direction = create(signal(element), {
        minScrollable: () => chrome,
      });

      /** Mirrors a consumer collapsing on `"down"`: the scroller takes the chrome's height. */
      const applyCollapse = () => {
        collapsed = direction() === "down";
        setClientHeight(element, collapsed ? 500 + chrome : 500);

        // The browser clamps an offset past the shortened content.
        const maxTop = element.scrollHeight - element.clientHeight;
        if (element.scrollTop > maxTop) {
          element.scrollTop = Math.max(0, maxTop);
        }
      };

      for (const top of [20, 40, 20, 40, 20]) {
        await scrollTo(element, top);
        applyCollapse();

        // 30px of overflow can never afford to give back 48px, so the gate must never open.
        expect(direction()).toBe("up");
        expect(collapsed).toBe(false);
      }
    });

    it("stays down through the clamp once the region could afford the collapse", async () => {
      // The other side of the same loop: enough overflow to clear the floor, so collapsing is
      // legitimate and must not be undone by the clamp it causes.
      const chrome = 48;
      const element = createScrollable(560, 500);
      const direction = create(signal(element), { minScrollable: () => chrome });

      await scrollTo(element, 55);
      expect(direction()).toBe("down");

      // The collapse hands back 48px, leaving 12px of overflow and clamping the offset.
      setClientHeight(element, 548);
      await scrollTo(element, 12);
      expect(direction()).toBe("down");

      // Further scrolling at the bottom keeps it there rather than reopening.
      await scrollTo(element, 12);
      expect(direction()).toBe("down");
    });

    it("reads a callback floor on each flip, for chrome that is measured after the first render", async () => {
      const element = createScrollable(540, 500);
      let chromeHeight = 0;
      const direction = create(signal(element), { minScrollable: () => chromeHeight });

      await scrollTo(element, 30);
      expect(direction()).toBe("down");

      await scrollTo(element, 0);
      expect(direction()).toBe("up");

      chromeHeight = 48;

      await scrollTo(element, 30);
      expect(direction()).toBe("up");
    });
  });

  it("does not flip on a viewport-sized jump", async () => {
    const element = createScrollable(2000, 500);
    const direction = create(signal(element));

    // A scroll position restore, rather than the user scrolling.
    await scrollTo(element, 500);
    expect(direction()).toBe("up");

    await scrollTo(element, 600);
    expect(direction()).toBe("down");
  });

  it("stops listening to an element once it is replaced", async () => {
    const first = createScrollable();
    const second = createScrollable();
    const scrollable = signal<HTMLElement | null>(first);
    const direction = create(scrollable);

    scrollable.set(second);
    await nextFrame();

    await scrollTo(first, 200);
    expect(direction()).toBe("up");

    await scrollTo(second, 200);
    expect(direction()).toBe("down");
  });
});
