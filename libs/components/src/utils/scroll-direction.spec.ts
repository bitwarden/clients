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
