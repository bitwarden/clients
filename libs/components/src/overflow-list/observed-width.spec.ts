import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from "@angular/core";
import { TestBed, fakeAsync, tick } from "@angular/core/testing";

import { observedWidth } from "./observed-width";

// JSDOM implements neither ResizeObserver nor layout, so these tests exercise the
// helper's plumbing — priming, target resolution, entry unwrapping, teardown — not
// measurement. Three things are only observable in a real browser and are checked by
// dragging the resizable Storybook stories instead:
//   - that a real ResizeObserver fires at all, and when it fires relative to paint;
//   - real widths (`clientWidth` is 0 here unless stubbed, so the numbers below are
//     whatever the stub was told to report);
//   - the content-box vs `clientWidth` divergence under horizontal padding — the whole
//     reason the callback reads `contentBoxSize` — since JSDOM computes no box model.
class ResizeObserverStub {
  static latest: ResizeObserverStub | undefined;
  readonly observed: Element[] = [];
  disconnectCount = 0;

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.latest = this;
  }

  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnectCount++;
  }

  /** Dispatch a resize entry as the browser would. */
  emit(entry: Partial<ResizeObserverEntry>) {
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

/** Passes its own host element directly — the shape used by the directive and breadcrumbs. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
class DirectHostComponent {
  readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly width = observedWidth(this.hostRef);
}

/**
 * Passes an accessor over a `viewChild` — the shape used by the bulk actions bar,
 * where the element doesn't exist while field initializers run.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #target></div>`,
})
class AccessorHostComponent {
  readonly target = viewChild.required<ElementRef<HTMLElement>>("target");
  readonly width = observedWidth(() => this.target());
}

/** Passes an accessor that never resolves to an element. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
class NullTargetHostComponent {
  readonly width = observedWidth(() => null);
}

describe("observedWidth", () => {
  // JSDOM reports 0 for every element, and the helper primes inside
  // `afterNextRender` — which runs during the first `detectChanges()`, before a
  // test could reach a `viewChild`'s element. So geometry is stubbed on the
  // prototype and varied through this variable.
  let stubbedClientWidth = 0;
  let originalClientWidth: PropertyDescriptor | undefined;

  beforeAll(() => {
    originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => stubbedClientWidth,
    });
  });

  afterAll(() => {
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
    }
  });

  beforeEach(() => {
    stubbedClientWidth = 0;
    ResizeObserverStub.latest = undefined;
  });

  it("reads 0 before the first render", () => {
    const fixture = TestBed.createComponent(DirectHostComponent);

    expect(fixture.componentInstance.width()).toBe(0);
  });

  it("primes from clientWidth at first render when given an element directly", fakeAsync(() => {
    stubbedClientWidth = 240;
    const fixture = TestBed.createComponent(DirectHostComponent);

    fixture.detectChanges();
    tick();

    expect(fixture.componentInstance.width()).toBe(240);
  }));

  it("primes from clientWidth at first render when given an accessor", fakeAsync(() => {
    // The accessor is what makes this work: the `#target` element doesn't exist
    // while the field initializer runs, only by the time `afterNextRender` fires.
    stubbedClientWidth = 180;
    const fixture = TestBed.createComponent(AccessorHostComponent);

    fixture.detectChanges();
    tick();

    expect(fixture.componentInstance.width()).toBe(180);
  }));

  it("observes the resolved element exactly once", fakeAsync(() => {
    const fixture = TestBed.createComponent(AccessorHostComponent);
    fixture.detectChanges();
    tick();

    expect(ResizeObserverStub.latest!.observed).toEqual([
      fixture.componentInstance.target().nativeElement,
    ]);
  }));

  it("tracks the content-box inline size from resize entries", fakeAsync(() => {
    stubbedClientWidth = 240;
    const fixture = TestBed.createComponent(DirectHostComponent);
    fixture.detectChanges();
    tick();

    ResizeObserverStub.latest!.emit({ contentBoxSize: [{ inlineSize: 320, blockSize: 10 }] });

    expect(fixture.componentInstance.width()).toBe(320);
  }));

  it("falls back to contentRect when the entry carries no content box", fakeAsync(() => {
    const fixture = TestBed.createComponent(DirectHostComponent);
    fixture.detectChanges();
    tick();

    ResizeObserverStub.latest!.emit({
      contentBoxSize: [],
      contentRect: { width: 275 } as DOMRectReadOnly,
    });

    expect(fixture.componentInstance.width()).toBe(275);
  }));

  it("disconnects the observer when the calling context is destroyed", fakeAsync(() => {
    const fixture = TestBed.createComponent(DirectHostComponent);
    fixture.detectChanges();
    tick();

    fixture.destroy();

    expect(ResizeObserverStub.latest!.disconnectCount).toBe(1);
  }));

  it("disconnects even when destroyed before the first render", () => {
    const fixture = TestBed.createComponent(DirectHostComponent);

    // `onDestroy` is registered eagerly rather than inside `afterNextRender`, so a
    // context torn down before it ever rendered still releases the observer.
    fixture.destroy();

    expect(ResizeObserverStub.latest!.disconnectCount).toBe(1);
    expect(ResizeObserverStub.latest!.observed).toEqual([]);
  });

  it("stays at 0 and never observes when the target doesn't resolve", fakeAsync(() => {
    const fixture = TestBed.createComponent(NullTargetHostComponent);
    fixture.detectChanges();
    tick();

    expect(fixture.componentInstance.width()).toBe(0);
    expect(ResizeObserverStub.latest!.observed).toEqual([]);
  }));
});
