import {
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";

import { OverflowItemDirective } from "./overflow-item.directive";
import { OverflowTriggerDirective } from "./overflow-trigger.directive";
import { PackedItems, pack } from "./pack";

/**
 * Manages a horizontal row of items that should not wrap. Items that don't fit
 * are hidden in place and surfaced through the `overflow()` signal — the
 * consumer renders them elsewhere, typically inside a menu opened by a "More"
 * affordance.
 *
 * Usage:
 * ```html
 * <div bitOverflowList [gap]="24" #ovf="bitOverflowList">
 *   @for (item of items(); track item.id) {
 *     <button bitOverflowItem [pinned]="item.id === selected()">{{ item.label }}</button>
 *   }
 * </div>
 * <bit-menu [hidden]="ovf.overflow().length === 0">
 *   @for (i of ovf.overflow(); track i) {
 *     <button bitMenuItem>{{ items()[i].label }}</button>
 *   }
 * </bit-menu>
 * ```
 *
 * Items must remain in the DOM — the directive needs them around to measure —
 * so overflowed items are hidden in place, not removed.
 */
@Directive({
  selector: "[bitOverflowList]",
  exportAs: "bitOverflowList",
  host: {
    "[style.gap.px]": "gap()",
  },
})
export class OverflowListDirective {
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  // descendants: true — items live inside @for blocks, not as direct children.
  private readonly queriedItems = contentChildren(OverflowItemDirective, { descendants: true });

  /**
   * Override for the `contentChildren` query. Use when items can't be queried
   * directly — e.g., projected through `<ng-content>` in a wrapping component.
   */
  readonly itemsInput = input<readonly OverflowItemDirective[] | null>(null, { alias: "items" });
  readonly items = computed(() => this.itemsInput() ?? this.queriedItems());

  /** Trailing affordance whose width the directive reserves when packing. */
  private readonly trigger = contentChild(OverflowTriggerDirective, { descendants: true });

  /** Horizontal gap between items, in pixels. Should match the host's CSS gap. */
  readonly gap = input(0);

  /**
   * External container width override (px). When non-null, the directive packs
   * against this value instead of its own host's inline size — required when
   * the host is content-sized in its parent, since observing it would create a
   * feedback loop (hiding an item shrinks the host → resize fires → another
   * item hides → ...). Derive this from a stable ancestor.
   */
  readonly containerWidth = input<number | null>(null);

  private readonly observedContainerWidth = signal(0);
  private readonly itemWidths = signal<readonly number[]>([]);
  private readonly triggerWidth = signal(0);
  private readonly resolvedContainerWidth = computed(
    () => this.containerWidth() ?? this.observedContainerWidth(),
  );

  /** First item with `[pinned]=true`, or null. */
  private readonly pinIndex = computed(() => {
    const items = this.items();
    for (let i = 0; i < items.length; i++) {
      if (items[i].pinned()) {
        return i;
      }
    }
    return null;
  });

  private readonly packed = computed<PackedItems>(() => {
    const count = this.items().length;
    const widths = this.itemWidths();
    const containerWidth = this.resolvedContainerWidth();

    // Nothing to pack, widths not cached yet, or container not measured.
    if (count === 0 || widths.length < count || containerWidth <= 0) {
      return { displayed: indices(count), overflow: [] };
    }

    const gap = this.gap();
    const triggerAlwaysShow = this.trigger()?.alwaysShow() ?? false;
    const totalWidth = widths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);

    // Everything fits and the trigger isn't pinned visible — no need to
    // reserve trigger width, since it'll be hidden anyway.
    if (!triggerAlwaysShow && totalWidth <= containerWidth) {
      return pack(widths, containerWidth, gap, this.pinIndex());
    }

    const triggerReserve = this.triggerWidth() > 0 ? this.triggerWidth() + gap : 0;
    const available = containerWidth - triggerReserve;

    // Trigger reservation consumes the whole container. `pack` treats a
    // non-positive container as "not measured" and returns all displayed,
    // so short-circuit to "everything overflows" here.
    if (available <= 0) {
      return { displayed: [], overflow: indices(count) };
    }

    return pack(widths, available, gap, this.pinIndex());
  });

  /** Indices of items rendered in the visible row, in DOM order. */
  readonly displayed = computed(() => this.packed().displayed);
  /** Indices of items the consumer should surface via the overflow affordance. */
  readonly overflow = computed(() => this.packed().overflow);

  /** True after the first measurement — consumers gate initial paint on this. */
  readonly ready = signal(false);

  constructor() {
    const injector = inject(Injector);

    const ro = new ResizeObserver((entries) =>
      this.observedContainerWidth.set(entries[0].contentBoxSize[0].inlineSize),
    );

    afterNextRender(() => {
      this.measureItems();
      ro.observe(this.hostEl);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });

    // Cached widths must keep pace when the item count changes (observable-
    // driven consumers can grow or shrink the set). A new set may interleave
    // fresh and old items, so reusing prior widths by identity isn't reliable
    // — just remeasure from scratch.
    effect(() => {
      const count = this.items().length;
      if (count === 0 || count === this.itemWidths().length) {
        return;
      }
      afterNextRender(() => this.measureItems(), { injector });
    });

    // Apply the pack decision to the DOM. Trigger updates are gated on
    // `ready` so its first-pass measurement happens while still visible.
    effect(() => {
      const overflowList = this.overflow();
      const displayedList = this.displayed();
      const overflowSet = new Set(overflowList);
      const lonelyIndex =
        displayedList.length === 1 && overflowList.length > 0 ? displayedList[0] : -1;
      this.items().forEach((item, i) => {
        applyHide(item.elementRef.nativeElement, overflowSet.has(i));
        item.shouldShrink.set(i === lonelyIndex);
      });
      const trigger = this.trigger();
      if (this.ready() && trigger) {
        applyHide(
          trigger.elementRef.nativeElement,
          overflowList.length === 0 && !trigger.alwaysShow(),
        );
      }
    });
  }

  private measureItems(): void {
    // document.fonts is missing in JSDOM — fall back to an already-resolved promise.
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => {
      const items = this.items();
      const trigger = this.trigger();
      // Hidden elements report zero from getBoundingClientRect, so reveal
      // anything we're about to measure and restore afterwards.
      const restoreItems = items.map((item) => revealForMeasurement(item.elementRef.nativeElement));
      const restoreTrigger = trigger
        ? revealForMeasurement(trigger.elementRef.nativeElement)
        : null;

      this.itemWidths.set(items.map((item) => measureWidth(item.elementRef.nativeElement)));
      if (trigger) {
        this.triggerWidth.set(measureWidth(trigger.elementRef.nativeElement));
      }

      restoreItems.forEach((restore) => restore());
      restoreTrigger?.();

      this.ready.set(true);
    });
  }
}

function indices(count: number): readonly number[] {
  return Array.from({ length: count }, (_, i) => i);
}

function measureWidth(el: HTMLElement): number {
  return Math.ceil(el.getBoundingClientRect().width);
}

/**
 * Hide an element by both setting the `hidden` attribute and an inline
 * `display: none`. The attribute alone isn't enough: consumers commonly apply
 * `display: flex`/`inline-flex` via classes, which win on specificity over the
 * user-agent `[hidden] { display: none }` rule.
 */
function applyHide(el: HTMLElement, hide: boolean): void {
  el.hidden = hide;
  el.style.display = hide ? "none" : "";
}

/**
 * Temporarily unhide an element so its natural width can be read. Returns a
 * function that restores the prior `hidden` and inline `display` state.
 */
function revealForMeasurement(el: HTMLElement): () => void {
  const prevHidden = el.hidden;
  const prevDisplay = el.style.display;
  el.hidden = false;
  el.style.display = "";
  return () => {
    el.hidden = prevHidden;
    el.style.display = prevDisplay;
  };
}
