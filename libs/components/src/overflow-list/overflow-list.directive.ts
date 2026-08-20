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
  untracked,
} from "@angular/core";

import { measureWidth, revealForMeasurement } from "./measure";
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
  private readonly injector = inject(Injector);
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
  /** The item instances that produced the current `itemWidths`; drives cache invalidation. */
  private measuredItems: readonly OverflowItemDirective[] = [];
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

    // Nothing to pack, container not measured, or a stale cache after the item
    // set changed. Any length mismatch falls back to the full set, so packing
    // never indexes past the current items.
    if (count === 0 || widths.length !== count || containerWidth <= 0) {
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
    // so decide here instead. A pinned item still has to stay visible.
    if (available <= 0) {
      const pin = this.pinIndex();
      return pin === null
        ? { displayed: [], overflow: indices(count) }
        : { displayed: [pin], overflow: indices(count).filter((i) => i !== pin) };
    }

    return pack(widths, available, gap, this.pinIndex());
  });

  /** Indices of items rendered in the visible row, in DOM order. */
  readonly displayed = computed(() => this.packed().displayed);
  /** Indices of items the consumer should surface via the overflow affordance. */
  readonly overflow = computed(() => this.packed().overflow);

  /** True after the first measurement — consumers gate initial paint on this. */
  readonly ready = signal(false);

  /**
   * True when the list is hiding the overflow trigger — nothing overflowed and the
   * trigger isn't pinned visible. False until `ready`, since the trigger is left
   * rendered through the first measurement pass.
   */
  readonly triggerHidden = computed(
    () => this.ready() && this.overflow().length === 0 && !(this.trigger()?.alwaysShow() ?? false),
  );

  /**
   * Elements the list is currently hiding: overflowed items, plus the trigger when
   * it's hidden. Consumers that manage focus (a roving tabindex, say) read this to
   * tell which of their controls have become unreachable.
   */
  readonly hiddenElements = computed(() => {
    const items = this.items();
    const hidden = new Set<HTMLElement>();
    for (const i of this.overflow()) {
      const el = items[i]?.elementRef.nativeElement;
      if (el) {
        hidden.add(el);
      }
    }
    const trigger = this.trigger();
    if (trigger && this.triggerHidden()) {
      hidden.add(trigger.elementRef.nativeElement);
    }
    return hidden;
  });

  constructor() {
    const ro = new ResizeObserver((entries) =>
      this.observedContainerWidth.set(entries[0].contentBoxSize[0].inlineSize),
    );

    afterNextRender(() => {
      this.measureItems();
      ro.observe(this.hostEl);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });

    // Remeasure whenever the item set changes. Compared by instance identity
    // rather than count, so a same-length swap is caught too. A new set may
    // interleave fresh and old items, so reusing prior widths per-item isn't
    // reliable; remeasure from scratch.
    effect(() => {
      const items = this.items();
      if (items.length === 0 || sameItems(items, this.measuredItems)) {
        return;
      }
      // Drop stale widths on this tick so `packed` falls back to all-displayed
      // instead of packing against measurements of a set we no longer have.
      this.itemWidths.set([]);
      // Before the first pass this no-ops; the constructor's queued measurement
      // reads `items()` when it runs, so it picks up the new set anyway.
      this.remeasure();
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
        applyHide(trigger.elementRef.nativeElement, this.triggerHidden());
      }
    });
  }

  /**
   * Re-cache item widths. Call when something outside the directive changes how
   * the same items render (density, label visibility, font size) — the directive
   * only remeasures on its own when the item set changes.
   *
   * Keeps the existing widths until the new measurement lands; clearing them
   * would flash all-displayed and overflow the row mid-resize.
   *
   * No-ops before the first measurement pass, so a caller can't race the
   * directive's own initial measurement — that pass is already queued.
   */
  remeasure(): void {
    // Read untracked: this runs inside callers' effects, and tracking `ready`
    // would make every one of them re-run when it flips.
    if (!untracked(this.ready)) {
      return;
    }
    afterNextRender(() => this.measureItems(), { injector: this.injector });
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
      // Record what was actually measured, so the invalidation effect
      // self-corrects if the items changed again while this pass was pending.
      this.measuredItems = items;
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

/** True when both arrays hold the same item instances in the same order. */
function sameItems(
  a: readonly OverflowItemDirective[],
  b: readonly OverflowItemDirective[],
): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
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
