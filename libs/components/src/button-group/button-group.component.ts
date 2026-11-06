import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";

import { measureWidth, observedWidth } from "../overflow-list";

export type ButtonGroupOrientation = "horizontal" | "vertical" | "auto";

/**
 * Lays out a set of related buttons in a row or a stack, optionally sharing the full
 * width of the container equally.
 */
@Component({
  selector: "bit-button-group",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-gap-3",
    "[class]": "classes()",
  },
})
export class ButtonGroupComponent {
  /**
   * `auto` keeps the buttons in a row while they fit the width the container gives the
   * group, and stacks them all once they don't.
   */
  readonly orientation = input<ButtonGroupOrientation>("horizontal");

  /**
   * Whether the buttons in a row share the full width of the container equally.
   * Stacked buttons always stretch.
   */
  readonly fullWidth = input(false, { transform: booleanAttribute });

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly width = observedWidth(this.host);
  private readonly naturalWidths = signal<number[]>([]);
  private readonly gap = signal(0);

  private readonly gaps = computed(() => this.gap() * Math.max(0, this.naturalWidths().length - 1));

  /** The width, in px, the buttons need in a single row at their natural sizes. */
  readonly naturalWidth = computed(
    () => this.naturalWidths().reduce((sum, w) => sum + w, 0) + this.gaps(),
  );

  private readonly rowWidth = computed(() => {
    if (!this.fullWidth()) {
      return this.naturalWidth();
    }
    const widths = this.naturalWidths();
    return Math.max(0, ...widths) * widths.length + this.gaps();
  });

  protected readonly stacked = computed(() => {
    switch (this.orientation()) {
      case "vertical":
        return true;
      case "horizontal":
        return false;
      case "auto":
        return !this.fits();
    }
  });

  private readonly fits = signal(true);

  protected readonly classes = computed(() =>
    [
      ...(this.stacked()
        ? ["tw-flex", "tw-flex-col", "tw-items-stretch"]
        : this.fullWidth()
          ? ["tw-grid", "tw-grid-flow-col", "tw-auto-cols-fr", "[&>*]:tw-min-w-0"]
          : ["tw-flex", "tw-items-center"]),
    ].join(" "),
  );

  constructor() {
    // Measured from the DOM rather than content queries so buttons re-projected through
    // another component's `ng-content` are included. Natural widths don't depend on the
    // current layout, so switching orientation can't feed back into the decision.
    const observer = new MutationObserver(() => this.measure());
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    const fonts = inject(DOCUMENT).fonts;
    afterNextRender(() => {
      observer.observe(this.host, { childList: true, subtree: true, characterData: true });
      // document.fonts is missing in JSDOM — fall back to an already-resolved promise.
      void (fonts?.ready ?? Promise.resolve()).then(() => this.measure());
    });

    effect(() => {
      this.width();
      untracked(() => this.measure());
    });

    // Reads the width live rather than from `width()`: a `fullWidth` change resizes the host
    // before the ResizeObserver reports it, and the stale value would paint a stacked frame.
    afterRenderEffect(() => {
      this.width();
      const rowWidth = this.rowWidth();
      const width = this.host.clientWidth;
      this.fits.set(width === 0 || rowWidth <= width);
    });
  }

  private measure() {
    const buttons = Array.from(this.host.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0,
    );
    this.naturalWidths.set(
      buttons.map((el) => {
        const prev = el.style.width;
        el.style.width = "max-content";
        const width = measureWidth(el);
        el.style.width = prev;
        return width;
      }),
    );
    this.gap.set(parseFloat(getComputedStyle(this.host).columnGap) || 0);
  }
}
