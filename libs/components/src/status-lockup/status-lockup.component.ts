import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from "@angular/core";

import { TypographyDirective } from "../typography/typography.directive";
import { BREAKPOINTS } from "../utils/responsive-utils";

/**
 * The status lockup component is a centered lockup used to communicate a state or error to the user
 * through a combination of illustration, heading, body text, and an optional call-to-action button.
 */
@Component({
  selector: "bit-status-lockup",
  templateUrl: "./status-lockup.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypographyDirective],
})
export class StatusLockupComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Layout size -- defaults to `base`. `base` scales itself down to `small` whenever the containing
   * element is narrower than the `md` breakpoint; `small` stays small at every width.
   */
  readonly size = input<"base" | "small">("base");

  /** Whether the element the status lockup renders into is under the `md` breakpoint. */
  private readonly containerIsNarrow = signal(false);

  /** The size actually rendered, once the container has been taken into account. */
  protected readonly effectiveSize = computed(() =>
    this.size() === "small" || this.containerIsNarrow() ? "small" : "base",
  );

  constructor() {
    // Measured off the parent with a ResizeObserver rather than a CSS container query: a container
    // query can only measure `bit-status-lockup`'s own box, and consumers routinely make that box a
    // flex item, which shrink-to-fits its content instead of filling the space available to it.
    afterNextRender(() => {
      const container = this.measurableContainer();
      if (container == null) {
        return;
      }

      // Track which side of the breakpoint the container is on rather than its width, so a width
      // that oscillates by a sub-pixel doesn't re-run change detection. Measured with
      // `getBoundingClientRect()` because `clientWidth` reports `0` for the inline parents some
      // consumers render into.
      const update = () =>
        this.containerIsNarrow.set(container.getBoundingClientRect().width < BREAKPOINTS.md);

      update();

      // Hosts without a full DOM -- jsdom under test, most notably -- don't implement
      // `ResizeObserver`. The measurement above still applies; the layout just stops reacting to
      // later resizes.
      if (typeof ResizeObserver === "undefined") {
        return;
      }

      const observer = new ResizeObserver(update);
      observer.observe(container);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /**
   * The nearest ancestor whose width reflects the space available to the layout. Walks past
   * `display: contents` ancestors, which generate no box of their own and so always measure `0`
   */
  private measurableContainer(): HTMLElement | null {
    let container = this.host.nativeElement.parentElement;
    while (container != null && getComputedStyle(container).display === "contents") {
      container = container.parentElement;
    }
    return container;
  }
}
