import { ElementRef, Signal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { settledHeight } from "./settled-height";

/** jsdom reports `0` for every layout measurement, so the height has to be stubbed. */
const createElement = (offsetHeight: number) => {
  const element = document.createElement("div");
  setHeight(element, offsetHeight);
  return element;
};

/** Redefinable because the whole point is that the height moves while the region animates. */
const setHeight = (element: HTMLElement, offsetHeight: number) =>
  Object.defineProperty(element, "offsetHeight", { value: offsetHeight, configurable: true });

const endTransition = (element: HTMLElement) =>
  element.dispatchEvent(new Event("transitionend", { bubbles: true }));

describe("settledHeight", () => {
  const create = (
    element: Signal<ElementRef<HTMLElement> | HTMLElement | null>,
    expanded: Signal<boolean>,
  ): Signal<number> => TestBed.runInInjectionContext(() => settledHeight(element, expanded));

  it("measures the element on first render, which is always settled", () => {
    const height = create(signal(createElement(48)), signal(true));
    TestBed.tick();

    expect(height()).toBe(48);
  });

  it("accepts an ElementRef", () => {
    const height = create(signal(new ElementRef(createElement(48))), signal(true));
    TestBed.tick();

    expect(height()).toBe(48);
  });

  it("reports zero while there is no element", () => {
    const height = create(signal(null), signal(true));
    TestBed.tick();

    expect(height()).toBe(0);
  });

  it("holds the expanded height while the region is collapsed", () => {
    const element = createElement(48);
    const expanded = signal(true);
    const height = create(signal(element), expanded);
    TestBed.tick();

    // The collapse animates the height to nothing, but the floor still needs what it would occupy.
    expanded.set(false);
    setHeight(element, 0);
    endTransition(element);
    TestBed.tick();

    expect(height()).toBe(48);
  });

  it("ignores intermediate heights while the region animates back open", () => {
    const element = createElement(48);
    const expanded = signal(true);
    const height = create(signal(element), expanded);
    TestBed.tick();

    expanded.set(false);
    setHeight(element, 0);
    endTransition(element);
    TestBed.tick();

    // Re-expanding, `expanded` flips first and the height catches up, so a live read here is what
    // would under-report the floor.
    expanded.set(true);
    setHeight(element, 12);
    TestBed.tick();

    expect(height()).toBe(48);
  });

  it("re-measures once the expanding transition finishes", () => {
    const element = createElement(48);
    const expanded = signal(true);
    const height = create(signal(element), expanded);
    TestBed.tick();

    // Compact mode, or a title that now wraps, changes the settled height.
    setHeight(element, 64);
    endTransition(element);
    TestBed.tick();

    expect(height()).toBe(64);
  });

  it("does not adopt a height measured while collapsed", () => {
    const element = createElement(48);
    const expanded = signal(false);
    const height = create(signal(element), expanded);
    TestBed.tick();

    setHeight(element, 0);
    endTransition(element);
    TestBed.tick();

    expect(height()).toBe(0);
  });
});
