import {
  Directive,
  ElementRef,
  OnDestroy,
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
 * Collapses this element while the user scrolls down the region marked with
 * `bitScrollCollapseSource`, and restores it as soon as they scroll back up.
 *
 * For short viewports — the extension popup especially — where page chrome is worth more
 * as content space once the user is reading down a list.
 *
 * The element must have exactly one element child, which becomes the collapsing row.
 * Further children would land in implicit grid rows and wouldn't collapse. Put any block
 * padding on that child rather than here, so it collapses with the row instead of holding
 * the region open.
 *
 * The region is only ever visually clipped, never removed from the accessibility tree, so
 * tabbing into it brings it into view rather than leaving a focus ring clipped. If it holds
 * focus when the collapse comes due, focus moves out to the nearest focusable ancestor —
 * usually the scrollable region the user is already reading — rather than being hidden along
 * with the element it sits on. Under `prefers-reduced-motion: reduce` the collapse is instant.
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
export class CollapseOnScrollDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(ScrollCollapseService);

  /** Whether to collapse at all, so a consumer can gate the behavior. */
  readonly bitCollapseOnScroll = input(true, { transform: booleanAttribute });

  /**
   * Whether the region contains focus. Tracked here rather than left to CSS `:focus-within` so the
   * collapse is a single piece of state — the collapsed styles override the child's padding, and CSS
   * offers no way to take an override back out again under `:focus-within`.
   */
  protected readonly hasFocus = signal(false);

  protected readonly state = computed<CollapseOnScrollState>(() =>
    this.bitCollapseOnScroll() && !this.hasFocus() && this.service.direction() === "down"
      ? "collapsed"
      : "expanded",
  );

  /**
   * Hands focus to the nearest focusable ancestor when the collapse comes due while this region
   * holds it, so the collapse isn't blocked by a control the user is no longer using — the vault's
   * search is autofocused on open and keeps focus through a wheel scroll. Keyboard users tabbing
   * onward move focus out themselves, so this only ever fires for pointer scrolling.
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

  /**
   * The collapse is a single-row grid animating `grid-template-rows` between `1fr` and
   * `0fr`. There is no height ceiling to guess: the expanded region is whatever height its
   * content needs.
   *
   * Two things keep the row from stopping short of zero. `tw-min-h-0` lets the child shrink
   * past its content height, which a grid item's automatic minimum size would otherwise
   * prevent. And the child's own block padding still sizes the track — padding sits outside
   * the content box, so `min-height` never reaches it — hence zeroing it here. That one
   * needs `!`, since the consumer's own padding class carries equal specificity.
   */
  protected readonly collapseClasses = computed(() =>
    [
      // Tailwind emits `grid` after `block`, `flex`, and `table`, so this wins over whatever
      // display utility the host already carries — while `tw-hidden`, which comes later
      // still, keeps hiding the element outright.
      "tw-grid",
      "tw-overflow-hidden",
      "[&>*]:tw-min-h-0",
      "motion-safe:tw-transition-[grid-template-rows]",
      "tw-duration-200",
      "tw-ease-out",
      ...(this.state() === "collapsed"
        ? ["tw-grid-rows-[0fr]", "[&>*]:!tw-py-0"]
        : ["tw-grid-rows-[1fr]"]),
    ].join(" "),
  );

  /**
   * This region's height as chrome, which is what gates every region's collapse. Never less than
   * its expanded height: the row animates for `tw-duration-200` and measures ~0 once collapsed, and
   * a floor that drops away as the region closes would stop blocking the collapse it exists to
   * block.
   */
  private readonly height = settledHeight(
    computed(() => this.host),
    computed(() => this.state() === "expanded"),
  );

  constructor() {
    // Registered only while it can actually collapse, so a disabled region doesn't
    // inflate the chrome height that gates every other region's collapse.
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

  ngOnDestroy(): void {
    this.service.unregister(this.height);
  }
}
