import {
  Directive,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";

import { settledHeight } from "../utils/settled-height";

import { CollapseRegion, ScrollCollapseService } from "./scroll-collapse.service";

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
  "tw-duration-200",
  "tw-ease-out",
].join(" ");

/**
 * Declared separately so a restore can arrive collapsed rather than animating into it. One property
 * list, since a `tw-transition-colors` alongside it would set `transition-property` twice and the
 * winner would come down to stylesheet order.
 */
const COLLAPSE_TRANSITION = "motion-safe:tw-transition-[grid-template-rows,border-color]";

/**
 * Collapses this element while the user scrolls down the page's scroll region — the layout's
 * `bitScrollLayoutHost`, or a `bitScrollCollapseSource` where one reports — and restores it as soon
 * as they scroll back up. For short viewports — the extension popup especially — where that space
 * is worth more as content.
 *
 * The element must have exactly one element child, which becomes the collapsing row; further
 * children would land in implicit rows and wouldn't collapse. Put block padding on that child
 * rather than here, so it collapses with the row instead of holding the region open.
 *
 * The region is only ever visually clipped, never removed from the accessibility tree, so tabbing
 * into it brings it into view. Under `prefers-reduced-motion: reduce` the collapse is instant.
 *
 * The host's bottom border belongs to this directive: the bottom-most expanded region on a page
 * draws its seam, the one rule dividing the regions above the scroll area from the scrolled
 * content. A consumer wanting a border of its own there should put it on a wrapper.
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

  private readonly expanded = computed(() => this.state() === "expanded");

  protected readonly collapseClasses = computed(() => {
    // `popup-page` instantiates this unconditionally, so an opted-out page must keep its own box
    // rather than gain a grid and clipping it never asked for.
    if (!this.bitCollapseOnScroll()) {
      return "";
    }

    return [
      COLLAPSE_CLASSES,
      // A restored scroll position is already where the user left it, so there is nothing to
      // animate from — the same reason the title bar declares its transition late.
      ...(this.service.restoring() ? [] : [COLLAPSE_TRANSITION]),
      // The child's padding still sizes the track, since padding sits outside the content box
      // where `min-height` never reaches it. Needs `!` to beat the consumer's own padding class.
      ...(this.state() === "collapsed"
        ? ["tw-grid-rows-[0fr]", "[&>*]:!tw-py-0"]
        : ["tw-grid-rows-[1fr]"]),
      // The border box is kept either way, so drawing the seam doesn't change the region's height.
      "tw-border-0",
      "tw-border-b",
      "tw-border-solid",
      this.ownsSeam() ? "tw-border-border-base" : "tw-border-transparent",
    ].join(" ");
  });

  /** This region's collapsible height, which is what gates every region's collapse. */
  private readonly height = settledHeight(signal(this.host), this.expanded);

  /** One stable object, since the service registers regions by identity. */
  private readonly region: CollapseRegion = {
    height: this.height,
    // Collapsed, the region offers no seam: it holds its border box, so one drawn there would
    // stack against the region above it.
    seam: computed(() => (this.expanded() ? this.host.nativeElement : null)),
  };

  protected readonly ownsSeam = this.service.ownsSeam(this.region);

  constructor() {
    // Registered only while it can actually collapse, so a disabled region doesn't inflate the
    // collapsible height gating every other region.
    effect((onCleanup) => {
      if (!this.bitCollapseOnScroll()) {
        return;
      }

      this.service.register(this.region);
      onCleanup(() => this.service.unregister(this.region));
    });

    // `hasFocus` read untracked: the hand-off belongs to the collapse coming due, not to focus
    // arriving. Tracked, focus entering an already-collapsed region would be bounced straight back
    // out and the region could never be tabbed into.
    effect(() => {
      if (
        this.bitCollapseOnScroll() &&
        this.service.direction() === "down" &&
        untracked(this.hasFocus)
      ) {
        this.releaseFocus();
      }
    });
  }

  /**
   * Hands focus to the nearest focusable ancestor when the collapse comes due while this region
   * holds it, so an autofocused control inside it isn't left focused but clipped. Focus arriving
   * afterwards is left alone — it holds the region open instead.
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
