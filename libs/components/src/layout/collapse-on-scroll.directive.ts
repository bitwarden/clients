import {
  Directive,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";

import { settledHeight } from "../utils/settled-height";

import { ScrollCollapseService } from "./scroll-collapse.service";

/** Where a collapsing region currently sits. Published on `data-state`. */
export type CollapseOnScrollState = "collapsed" | "expanded";

/**
 * The collapse is a single-row grid animating `grid-template-rows` between `1fr` and `0fr`, so
 * there is no height ceiling to guess. `tw-min-h-0` lets the child shrink past its content height,
 * which a grid item's automatic minimum size would otherwise prevent.
 *
 * `tw-grid` is emitted after `block`, `flex`, and `table`, so it wins over whatever display utility
 * the host already carries, while `tw-hidden` comes later still and keeps hiding outright.
 */
const COLLAPSE_CLASSES = [
  "tw-grid",
  "tw-overflow-hidden",
  "[&>*]:tw-min-h-0",
  "motion-safe:tw-transition-[grid-template-rows]",
  "tw-duration-200",
  "tw-ease-out",
].join(" ");

/**
 * Collapses this element while the user scrolls down the region marked with
 * `bitScrollCollapseSource`, and restores it as soon as they scroll back up. For short viewports —
 * the extension popup especially — where chrome is worth more as content space.
 *
 * The element must have exactly one element child, which becomes the collapsing row; further
 * children would land in implicit rows and wouldn't collapse. Put block padding on that child
 * rather than here, so it collapses with the row instead of holding the region open.
 *
 * The region is only ever visually clipped, never removed from the accessibility tree, so tabbing
 * into it brings it into view. Under `prefers-reduced-motion: reduce` the collapse is instant.
 */
@Directive({
  selector: "[bitCollapseOnScroll]",
  host: {
    "[class]": "collapseClasses()",
    "[attr.data-state]": "state()",
    "(focusin)": "hasFocus.set(true)",
    "(focusout)": "hasFocus.set(false)",
  },
})
export class CollapseOnScrollDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(ScrollCollapseService);

  /** Whether to collapse at all, so a consumer can gate the behavior. */
  readonly bitCollapseOnScroll = input(true, { transform: booleanAttribute });

  /**
   * Whether the region contains focus. Tracked here rather than left to CSS `:focus-within`, since
   * the collapsed styles override the child's padding and CSS can't take that override back out.
   */
  protected readonly hasFocus = signal(false);

  protected readonly state = computed<CollapseOnScrollState>(() =>
    this.bitCollapseOnScroll() && !this.hasFocus() && this.service.direction() === "down"
      ? "collapsed"
      : "expanded",
  );

  protected readonly collapseClasses = computed(() =>
    this.state() === "collapsed"
      ? // The child's padding still sizes the track, since padding sits outside the content box
        // where `min-height` never reaches it. Needs `!` to beat the consumer's own padding class.
        `${COLLAPSE_CLASSES} tw-grid-rows-[0fr] [&>*]:!tw-py-0`
      : `${COLLAPSE_CLASSES} tw-grid-rows-[1fr]`,
  );

  /** This region's height as chrome, which is what gates every region's collapse. */
  private readonly height = settledHeight(
    signal(this.host),
    computed(() => this.state() === "expanded"),
  );

  constructor() {
    // Registered only while it can actually collapse, so a disabled region doesn't inflate the
    // chrome height gating every other region.
    effect((onCleanup) => {
      if (!this.bitCollapseOnScroll()) {
        return;
      }

      this.service.register(this.height);
      onCleanup(() => this.service.unregister(this.height));
    });

    effect(() => {
      if (this.bitCollapseOnScroll() && this.service.direction() === "down" && this.hasFocus()) {
        this.releaseFocus();
      }
    });
  }

  /**
   * Hands focus to the nearest focusable ancestor when the collapse comes due while this region
   * holds it — the vault's search is autofocused and keeps focus through a wheel scroll. Keyboard
   * users tabbing onward move focus out themselves, so this only fires for pointer scrolling.
   */
  private releaseFocus(): void {
    const host = this.host.nativeElement;
    const active = host.ownerDocument.activeElement;
    if (!(active instanceof HTMLElement) || !host.contains(active)) {
      return;
    }

    const destination = host.parentElement?.closest<HTMLElement>('[tabindex]:not([tabindex="-1"])');

    if (destination) {
      // `preventScroll` because focusing the scroll region would otherwise jump it back.
      destination.focus({ preventScroll: true });
    } else {
      active.blur();
    }

    this.hasFocus.set(false);
  }
}
