import { ChangeDetectionStrategy, Component, signal, viewChild } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";

import { OverflowItemDirective } from "./overflow-item.directive";
import { OverflowListDirective } from "./overflow-list.directive";
import { OverflowTriggerDirective } from "./overflow-trigger.directive";

// JSDOM does not implement ResizeObserver. The tests drive packing through the
// `containerWidth` input instead, so a no-op stub is enough to let the
// directive construct.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

interface Item {
  id: string;
  width: number;
}

@Component({
  imports: [OverflowListDirective, OverflowItemDirective, OverflowTriggerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div bitOverflowList [gap]="8" [containerWidth]="containerWidth()">
      @for (item of items(); track item.id; let i = $index) {
        <button
          bitOverflowItem
          type="button"
          [pinned]="pinnedIndex() === i"
          [attr.data-width]="item.width"
        >
          {{ item.id }}
        </button>
      }
      <button
        bitOverflowTrigger
        type="button"
        [alwaysShow]="alwaysShow()"
        [attr.data-width]="triggerWidth()"
      >
        More
      </button>
    </div>
  `,
})
class HostComponent {
  readonly items = signal<Item[]>([
    { id: "a", width: 100 },
    { id: "b", width: 100 },
    { id: "c", width: 100 },
  ]);
  readonly containerWidth = signal<number | null>(null);
  readonly pinnedIndex = signal<number | null>(null);
  readonly triggerWidth = signal(0);
  readonly alwaysShow = signal(false);
  readonly list = viewChild.required(OverflowListDirective);
}

describe("OverflowListDirective", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  // JSDOM reports zero for every geometry read, so packing can never be
  // exercised against real layout. Drive widths off a `data-width` attribute
  // instead — this keeps `measure.ts` in the code path rather than mocking it.
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

  beforeAll(() => {
    Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
      const width = Number(this.getAttribute("data-width") ?? 0);
      return {
        width,
        height: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };
  });

  afterAll(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  /** Flush the directive's `afterNextRender` + `fonts.ready` measurement pass. */
  const settle = () => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  };

  const list = () => host.list();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  describe("stale width cache", () => {
    it("never reports an overflow index past the end of the current item set", fakeAsync(() => {
      // 100 + (100 + 8) + (100 + 8) = 316 > 150, so `c` and `b` overflow.
      host.containerWidth.set(150);
      settle();
      expect(list().overflow()).toEqual([1, 2]);

      // Shrink to two items. The cached widths still describe three, and the
      // remeasure hasn't run yet — the directive must fall back to
      // all-displayed rather than pack against the stale array, which would
      // hand consumers index 2 for a two-item set.
      host.items.update((items) => items.slice(0, 2));
      fixture.detectChanges();

      expect(list().overflow()).toEqual([]);
      expect(list().displayed()).toEqual([0, 1]);

      // Once the remeasure lands it packs the new set: 100 + 108 = 208 > 150.
      settle();
      expect(list().overflow()).toEqual([1]);
      expect(Math.max(...list().overflow())).toBeLessThan(host.items().length);
    }));

    it("invalidates the cache on a same-length swap", fakeAsync(() => {
      // 100 + 108 = 208 <= 250, adding `c` at 108 exceeds it.
      host.containerWidth.set(250);
      settle();
      expect(list().displayed()).toEqual([0, 1]);
      expect(list().overflow()).toEqual([2]);

      // Same count, different item: `b` is replaced by a wider `d`. A
      // count-based cache check would miss this and keep packing 100/100/100.
      host.items.set([
        { id: "a", width: 100 },
        { id: "d", width: 200 },
        { id: "c", width: 100 },
      ]);
      settle();

      // 100 + (200 + 8) = 308 > 250, so only `a` still fits.
      expect(list().displayed()).toEqual([0]);
      expect(list().overflow()).toEqual([1, 2]);
    }));

    it("falls back to all-displayed while the item set grows", fakeAsync(() => {
      host.containerWidth.set(150);
      settle();
      expect(list().overflow()).toEqual([1, 2]);

      host.items.update((items) => [...items, { id: "d", width: 100 }]);
      fixture.detectChanges();

      expect(list().overflow()).toEqual([]);
      expect(list().displayed()).toEqual([0, 1, 2, 3]);
    }));
  });

  describe("remeasure()", () => {
    it("re-caches widths for an unchanged item set", fakeAsync(() => {
      host.containerWidth.set(250);
      settle();
      expect(list().displayed()).toEqual([0, 1]);

      // Same item instances, wider rendering — the sort of density change a
      // consumer makes (labels shown/hidden, padding swapped) that the
      // directive can't observe on its own.
      fixture.nativeElement
        .querySelectorAll("button[bitOverflowItem]")
        .forEach((el: HTMLElement) => el.setAttribute("data-width", "200"));

      list().remeasure();
      settle();

      // 200 alone leaves no room for a second item at 208.
      expect(list().displayed()).toEqual([0]);
      expect(list().overflow()).toEqual([1, 2]);
    }));

    it("keeps the current pack decision until the new measurement lands", fakeAsync(() => {
      host.containerWidth.set(150);
      settle();
      const before = list().overflow();

      list().remeasure();
      fixture.detectChanges();

      // Unlike the item-set-change path, `remeasure` must not clear the cache
      // up front — flashing all-displayed mid-resize would overflow the row.
      expect(list().overflow()).toEqual(before);
    }));

    it("clears the cache up front when asked to reset", fakeAsync(() => {
      host.containerWidth.set(150);
      settle();
      expect(list().overflow()).toEqual([1, 2]);

      // Consumers that only stamp an item's content while it's displayed need
      // the all-displayed fallback before measurement, or the collapsed items
      // measure as whatever skeleton is left in the row.
      list().remeasure({ reset: true });
      fixture.detectChanges();

      expect(list().displayed()).toEqual([0, 1, 2]);
      expect(list().overflow()).toEqual([]);

      // The pass still lands and re-packs against the current widths.
      settle();
      expect(list().overflow()).toEqual([1, 2]);
    }));

    it("no-ops before the first measurement pass has landed", fakeAsync(() => {
      host.containerWidth.set(250);
      settle();
      expect(list().displayed()).toEqual([0, 1]);

      // The first measurement resolves during setup, so wind `ready` back to
      // reproduce the pre-measure window.
      list().ready.set(false);
      fixture.nativeElement
        .querySelectorAll("button[bitOverflowItem]")
        .forEach((el: HTMLElement) => el.setAttribute("data-width", "200"));

      list().remeasure();
      settle();

      // The guard lives here rather than in every caller: a consumer-driven
      // remeasure must not race the directive's own first measurement. Widths
      // stay as they were, so the pack decision is unchanged.
      expect(list().displayed()).toEqual([0, 1]);
      expect(list().ready()).toBe(false);
    }));
  });

  describe("triggerHidden", () => {
    it("is false until the first measurement lands", fakeAsync(() => {
      host.containerWidth.set(400);
      fixture.detectChanges();

      // Everything fits, but the trigger has to stay rendered through the
      // first pass so it can be measured.
      expect(list().ready()).toBe(false);
      expect(list().triggerHidden()).toBe(false);
    }));

    it("is true once nothing overflows", fakeAsync(() => {
      // 100 + 108 + 108 = 316 <= 400.
      host.containerWidth.set(400);
      settle();

      expect(list().overflow()).toEqual([]);
      expect(list().triggerHidden()).toBe(true);
    }));

    it("is false while something has overflowed", fakeAsync(() => {
      host.containerWidth.set(150);
      settle();

      expect(list().overflow()).toEqual([1, 2]);
      expect(list().triggerHidden()).toBe(false);
    }));

    it("is false when the trigger opts out with alwaysShow", fakeAsync(() => {
      host.alwaysShow.set(true);
      host.containerWidth.set(400);
      settle();

      expect(list().overflow()).toEqual([]);
      expect(list().triggerHidden()).toBe(false);
    }));
  });

  describe("hiddenElements", () => {
    const itemEls = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll("button[bitOverflowItem]"));
    const triggerEl = (): HTMLElement =>
      fixture.nativeElement.querySelector("button[bitOverflowTrigger]");

    it("reports the overflowed items", fakeAsync(() => {
      host.containerWidth.set(150);
      settle();

      const hidden = list().hiddenElements();
      expect(hidden.has(itemEls()[0])).toBe(false);
      expect(hidden.has(itemEls()[1])).toBe(true);
      expect(hidden.has(itemEls()[2])).toBe(true);
    }));

    it("reports the trigger only while it is hidden", fakeAsync(() => {
      host.containerWidth.set(150);
      settle();
      expect(list().hiddenElements().has(triggerEl())).toBe(false);

      // Widen until nothing overflows — now the trigger is the hidden one.
      host.containerWidth.set(400);
      fixture.detectChanges();

      const hidden = list().hiddenElements();
      expect(hidden.has(triggerEl())).toBe(true);
      expect(itemEls().some((el) => hidden.has(el))).toBe(false);
    }));

    it("is empty when everything fits and the trigger opts out", fakeAsync(() => {
      host.alwaysShow.set(true);
      host.containerWidth.set(400);
      settle();

      expect(list().hiddenElements().size).toBe(0);
    }));
  });

  describe("trigger reserve consumes the container", () => {
    const itemEls = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll("button[bitOverflowItem]"));

    beforeEach(() => {
      // Reserving the trigger (60) plus the gap (8) leaves nothing of the
      // 60px container for the items themselves.
      host.triggerWidth.set(60);
      host.containerWidth.set(60);
    });

    it("overflows every item when nothing is pinned", fakeAsync(() => {
      settle();

      expect(list().displayed()).toEqual([]);
      expect(list().overflow()).toEqual([0, 1, 2]);
    }));

    it("keeps the pinned item displayed", fakeAsync(() => {
      host.pinnedIndex.set(1);
      settle();

      // The pin is the one guarantee `pack` makes unconditionally; the
      // no-room short-circuit must not sidestep it, or consumers that pin the
      // selected item (tabs) render an empty row.
      expect(list().displayed()).toEqual([1]);
      expect(list().overflow()).toEqual([0, 2]);
      expect(itemEls()[1].hidden).toBe(false);
    }));
  });
});
