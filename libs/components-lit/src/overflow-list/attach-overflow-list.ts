import { applyHide, measureWidth, observeWidth, revealForMeasurement } from "./measure";
import { OverflowStrategy, packOverflow } from "./pack";

export const OVERFLOW_PINNED_ATTRIBUTE = "data-overflow-pinned";
export const OVERFLOW_SHRINK_ATTRIBUTE = "data-overflow-shrink";

export type OverflowListOptions = {
  /** The managed items in DOM order. Called on every pass so dynamic lists stay correct. */
  items: () => readonly HTMLElement[];
  /** Trailing "More" affordance whose width is reserved once anything overflows. */
  trigger?: () => HTMLElement | null | undefined;
  /** Horizontal gap between items, in pixels. Should match the row's CSS gap. */
  gap?: number;
  /**
   * How items are chosen when they don't all fit:
   * - `"end"` (default) — keep leading items, overflow the trailing ones. Respects pinning.
   * - `"middle"` — keep the first and last items and overflow the run between them (the
   *   breadcrumb pattern). The last item is never dropped. Ignores pinning.
   */
  strategy?: OverflowStrategy;
  /**
   * Pack against this width instead of observing the container. Required when the container is
   * content-sized, since observing it would create a feedback loop (hiding an item shrinks the
   * container, which hides another item, ...). Derive it from a stable ancestor.
   */
  containerWidth?: number | null;
  /**
   * Item to keep visible regardless of space, e.g. the selected tab. Defaults to the first item
   * with the `data-overflow-pinned` attribute.
   */
  pinIndex?: number | null;
  /** Keep the trigger visible even when nothing overflows, e.g. it opens a menu with other items. */
  triggerAlwaysShow?: boolean;
  /**
   * Hide overflowed items and the unused trigger in place. Defaults to true. Turn off to apply the
   * decision yourself from `onChange`.
   */
  applyToDom?: boolean;
  onChange?: (state: OverflowListState) => void;
};

export type OverflowListState = {
  /** Indices of items rendered in the visible row, in DOM order. */
  displayed: readonly number[];
  /** Indices of items the consumer should surface via the overflow affordance. */
  overflow: readonly number[];
  /** True after the first measurement; consumers gate initial paint on this. */
  ready: boolean;
  /**
   * False while a measurement is pending and packing has fallen back to all-displayed, so
   * consumers can tell a transient empty `overflow` from one where everything fits.
   */
  measured: boolean;
  /** True when the trigger is hidden because nothing overflowed. False until `ready`. */
  triggerHidden: boolean;
  /**
   * Index of the only displayed item, or -1. That item is allowed to shrink (and truncate) only
   * after its siblings have been hidden, so CSS doesn't shrink it first.
   */
  shrinkIndex: number;
  /** Overflowed items plus the trigger when it's hidden. Use to keep roving focus off them. */
  hiddenElements: ReadonlySet<HTMLElement>;
};

export type OverflowListHandle = {
  readonly state: OverflowListState;
  /** Merge new options and re-pack. Remeasures if the item set changed. */
  update(options?: Partial<OverflowListOptions>): void;
  /**
   * Re-cache item widths. Call when something changes how the same items render (density, label
   * text, font size). Keeps the current decision until the new measurement lands unless
   * `reset` is set, which falls back to all-displayed first — needed when an item's content is
   * only rendered while it is displayed.
   */
  remeasure(options?: { reset?: boolean }): void;
  destroy(): void;
};

function sameItems(a: readonly HTMLElement[], b: readonly HTMLElement[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/**
 * Manages a horizontal row of items that should not wrap. Items that don't fit are hidden in
 * place and reported through `state.overflow` / `onChange`, so the consumer can render them
 * elsewhere, typically inside a menu opened by the trigger.
 *
 * Items must remain in the DOM — they're measured — so overflowed items are hidden, not removed.
 * Framework-neutral replacement for `bitOverflowList` / `bitOverflowItem` / `bitOverflowTrigger`.
 */
export function attachOverflowList(
  container: HTMLElement,
  initialOptions: OverflowListOptions,
): OverflowListHandle {
  let options: OverflowListOptions = { ...initialOptions };
  let observedWidth = 0;
  let itemWidths: number[] = [];
  let triggerWidth = 0;
  let measuredItems: readonly HTMLElement[] = [];
  let ready = false;
  let destroyed = false;
  let pass = 0;
  let lastSerialized = "";

  let state: OverflowListState = {
    displayed: [],
    overflow: [],
    ready: false,
    measured: false,
    triggerHidden: false,
    shrinkIndex: -1,
    hiddenElements: new Set(),
  };

  const pinIndex = (items: readonly HTMLElement[]) => {
    if (options.pinIndex !== undefined) {
      return options.pinIndex;
    }
    const index = items.findIndex((item) => item.hasAttribute(OVERFLOW_PINNED_ATTRIBUTE));
    return index === -1 ? null : index;
  };

  const recompute = () => {
    if (destroyed) {
      return;
    }
    const items = options.items();
    const trigger = options.trigger?.() ?? null;
    const count = items.length;
    const measured = ready && itemWidths.length === count && sameItems(items, measuredItems);
    const containerWidth = options.containerWidth ?? observedWidth;
    const triggerAlwaysShow = options.triggerAlwaysShow ?? false;

    const packed = measured
      ? packOverflow(itemWidths, containerWidth, {
          gap: options.gap ?? 0,
          triggerWidth,
          triggerAlwaysShow,
          pinIndex: pinIndex(items),
          strategy: options.strategy ?? "end",
        })
      : { displayed: items.map((_, i) => i), overflow: [] };

    const triggerHidden = ready && packed.overflow.length === 0 && !triggerAlwaysShow;
    const hiddenElements = new Set<HTMLElement>(packed.overflow.map((i) => items[i]));
    if (trigger && triggerHidden) {
      hiddenElements.add(trigger);
    }
    const shrinkIndex = packed.displayed.length === 1 ? packed.displayed[0] : -1;

    if (options.applyToDom !== false) {
      const overflowSet = new Set(packed.overflow);
      items.forEach((item, i) => {
        applyHide(item, overflowSet.has(i));
        item.toggleAttribute(OVERFLOW_SHRINK_ATTRIBUTE, i === shrinkIndex);
      });
      // The trigger stays rendered through the first pass so it can be measured.
      if (ready && trigger) {
        applyHide(trigger, triggerHidden);
      }
    }

    state = {
      displayed: packed.displayed,
      overflow: packed.overflow,
      ready,
      measured,
      triggerHidden,
      shrinkIndex,
      hiddenElements,
    };

    const serialized = JSON.stringify([
      packed.displayed,
      packed.overflow,
      ready,
      measured,
      triggerHidden,
    ]);
    if (serialized !== lastSerialized) {
      lastSerialized = serialized;
      options.onChange?.(state);
    }
  };

  const measure = async () => {
    const thisPass = ++pass;
    // Lit items render asynchronously; their width depends on their own render.
    await Promise.all(
      options
        .items()
        .map(
          (item) => (item as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete,
        ),
    );
    await (document.fonts?.ready ?? Promise.resolve());
    await new Promise(requestAnimationFrame);
    if (destroyed || thisPass !== pass) {
      return;
    }
    const items = options.items();
    const trigger = options.trigger?.() ?? null;
    // Hidden elements report zero from getBoundingClientRect, so reveal anything we're about to
    // measure and restore afterwards.
    const restore = [...items, ...(trigger ? [trigger] : [])].map(revealForMeasurement);
    itemWidths = items.map(measureWidth);
    triggerWidth = trigger ? measureWidth(trigger) : 0;
    restore.forEach((fn) => fn());
    measuredItems = items;
    ready = true;
    recompute();
  };

  const stopObserving = observeWidth(container, (width) => {
    observedWidth = width;
    recompute();
  });

  void measure();

  return {
    get state() {
      return state;
    },
    update(next) {
      options = { ...options, ...next };
      const items = options.items();
      if (ready && !sameItems(items, measuredItems)) {
        // Drop stale widths so packing falls back to all-displayed instead of using measurements
        // of a set we no longer have.
        itemWidths = [];
        void measure();
      }
      recompute();
    },
    remeasure({ reset = false } = {}) {
      if (!ready) {
        return;
      }
      if (reset) {
        itemWidths = [];
        recompute();
      }
      void measure();
    },
    destroy() {
      destroyed = true;
      stopObserving();
    },
  };
}
