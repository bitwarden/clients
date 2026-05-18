import {
  DestroyRef,
  Directive,
  ElementRef,
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
import { pack } from "./pack";

/**
 * Manages a horizontal row of items that should not wrap. Items that don't fit are
 * marked as overflow and hidden via the `hidden` attribute; the consumer renders them
 * however they wish (typically inside a menu opened by a "More" affordance placed
 * wherever makes sense in their layout).
 *
 * The directive owns measurement: it measures each item's natural width once at first
 * render (when no items have been hidden yet) and observes its host element for width
 * changes. The pack decision is a pure function of those cached widths plus the live
 * container width, so resizing never feeds the output back into the measurement.
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
 * Trade-off: items must always be rendered (`@for` over the full set) so the directive
 * can keep them measured. Items it overflows are removed visually via `hidden`, not
 * removed from the DOM.
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

  // descendants: true — items live inside @for blocks, not direct children.
  private readonly queriedItems = contentChildren(OverflowItemDirective, { descendants: true });
  /**
   * Explicit items list — overrides the contentChildren query. Use when items are
   * projected from outside the directive's host (e.g., via `<ng-content>` in a
   * wrapper component), so `contentChildren` can't see them.
   */
  readonly itemsInput = input<readonly OverflowItemDirective[] | null>(null, { alias: "items" });
  readonly items = computed(() => this.itemsInput() ?? this.queriedItems());

  /**
   * Optional trailing affordance (typically a "More" button). When present, its
   * width is reserved from the space available to items so packing leaves room
   * for it next to the last visible item.
   */
  private readonly trigger = contentChild(OverflowTriggerDirective, { descendants: true });

  /** Horizontal gap between items, in pixels. Should match the CSS gap of the host. */
  readonly gap = input(0);

  // --- measurement signals (data pipeline inputs) ---
  private readonly containerWidth = signal(0);
  private readonly itemWidths = signal<readonly number[]>([]);
  private readonly triggerWidth = signal(0);

  /** First item with `[pinned]=true`, or null if none. */
  private readonly pinIndex = computed(() => {
    const items = this.items();
    for (let i = 0; i < items.length; i++) {
      if (items[i].pinned()) {
        return i;
      }
    }
    return null;
  });

  private readonly packed = computed(() => {
    const count = this.items().length;
    const widths = this.itemWidths();
    if (count === 0 || widths.length < count) {
      return {
        displayed: Array.from({ length: count }, (_, i) => i) as readonly number[],
        overflow: [] as readonly number[],
      };
    }
    const containerWidth = this.containerWidth();
    const gap = this.gap();
    // First, check whether everything fits without reserving the trigger — when
    // it does, the trigger will be hidden and won't consume layout, so we'd be
    // overflowing items just to make room for an affordance we don't need.
    const totalWidth = widths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);
    if (totalWidth <= containerWidth) {
      return pack(widths, containerWidth, gap, this.pinIndex());
    }
    const triggerWidth = this.triggerWidth();
    const reserved = triggerWidth > 0 ? triggerWidth + gap : 0;
    const available = Math.max(0, containerWidth - reserved);
    return pack(widths, available, gap, this.pinIndex());
  });

  /** Indices of items rendered in the visible row, in DOM order. */
  readonly displayed = computed(() => this.packed().displayed);
  /** Indices of items that should be surfaced via the overflow affordance. */
  readonly overflow = computed(() => this.packed().overflow);

  /** Toggled true after the one-shot measurement so consumers can gate initial paint. */
  readonly ready = signal(false);

  constructor() {
    const ro = new ResizeObserver((entries) =>
      this.containerWidth.set(entries[0].contentBoxSize[0].inlineSize),
    );

    afterNextRender(() => {
      // document.fonts is missing in JSDOM — fall back to an already-resolved promise.
      const fontsReady = document.fonts?.ready ?? Promise.resolve();
      void fontsReady.then(() => {
        const items = this.items();
        this.itemWidths.set(
          items.map((item) =>
            Math.ceil(item.elementRef.nativeElement.getBoundingClientRect().width),
          ),
        );
        const trigger = this.trigger();
        if (trigger) {
          this.triggerWidth.set(
            Math.ceil(trigger.elementRef.nativeElement.getBoundingClientRect().width),
          );
        }
        this.ready.set(true);
      });
      ro.observe(this.hostEl);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });

    // Apply [hidden] to overflowed items and to the trailing trigger when there's
    // nothing to surface; flag the lone displayed item (if any) so consumers can
    // gate truncation styling on it. The trigger update is gated on `ready` so
    // its first-pass measurement happens while it's still visible.
    effect(() => {
      const overflowList = this.overflow();
      const displayedList = this.displayed();
      const overflowSet = new Set(overflowList);
      const lonelyIndex =
        displayedList.length === 1 && overflowList.length > 0 ? displayedList[0] : -1;
      this.items().forEach((item, i) => {
        item.elementRef.nativeElement.hidden = overflowSet.has(i);
        item.shouldShrink.set(i === lonelyIndex);
      });
      if (this.ready()) {
        const trigger = this.trigger();
        if (trigger) {
          trigger.elementRef.nativeElement.hidden = overflowList.length === 0;
        }
      }
    });
  }
}
