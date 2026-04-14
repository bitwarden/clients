import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

import { TooltipDirective } from "../tooltip/tooltip.directive";
import { truncateFilename } from "../utils/truncate-filename";

/**
 * Renders a filename with responsive middle-truncation that preserves the file extension.
 *
 * Measures the available container width via `ResizeObserver` and uses canvas text
 * measurement to determine how many characters fit. The `truncateFilename` utility
 * handles the 50/50 split: start of filename + `…` + end of filename + extension.
 *
 * Only truncates when the full filename actually exceeds the container width.
 * A tooltip shows the full filename on hover, and `aria-label` provides
 * the full filename for screen readers.
 *
 * @example
 *   <bit-truncated-filename [filename]="attachment.fileName" />
 */
@Component({
  selector: "bit-truncated-filename",
  template: `
    <span
      #container
      class="tw-block tw-flex-1 tw-min-w-0 tw-overflow-hidden tw-whitespace-nowrap"
      [bitTooltip]="filename()"
      [attr.aria-label]="filename()"
    >
      {{ displayText() }}
    </span>
  `,
  host: { class: "tw-contents" },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
})
export class TruncatedFilenameComponent implements AfterViewInit, OnDestroy {
  /** The full filename to display. */
  readonly filename = input.required<string>();

  /** The computed display text (full or middle-truncated). */
  protected readonly displayText = signal("");

  private readonly containerRef = viewChild<ElementRef<HTMLElement>>("container");
  private readonly destroyRef = inject(DestroyRef);
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private resizeObserver: ResizeObserver | null = null;
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private measureCanvas: HTMLCanvasElement | null = null;

  constructor() {
    // Recalculate when the filename input changes
    effect(() => {
      this.filename();
      this.recalculate();
    });
  }

  ngAfterViewInit(): void {
    const el = this.containerRef()?.nativeElement;
    if (!el) {
      return;
    }

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.recalculate());
      this.resizeObserver.observe(el);
    }
    this.recalculate();

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.measureCanvas = null;
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private recalculate(): void {
    const el = this.containerRef()?.nativeElement;
    const name = this.filename();

    if (!name || !el) {
      this.displayText.set(name ?? "");
      return;
    }

    const availableWidth = el.clientWidth;
    if (availableWidth <= 0) {
      this.displayText.set(name);
      return;
    }

    // Measure full text width using an offscreen canvas
    if (!this.measureCanvas) {
      this.measureCanvas = document.createElement("canvas");
    }
    const ctx = this.measureCanvas.getContext("2d");
    if (!ctx) {
      this.displayText.set(name);
      return;
    }

    const style = getComputedStyle(el);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

    const fullWidth = ctx.measureText(name).width;
    // clientWidth is rounded to an integer; canvas measureText returns a float.
    // Add a small tolerance to avoid truncating text that actually fits.
    if (fullWidth <= availableWidth + 4) {
      this.displayText.set(name);
      return;
    }

    // Start with a ratio-based estimate, then adjust by measuring the actual result
    let maxChars = Math.floor(name.length * (availableWidth / fullWidth));
    let truncated = truncateFilename(name, maxChars);

    // Shrink until it fits
    while (maxChars > 5 && ctx.measureText(truncated).width > availableWidth) {
      maxChars--;
      truncated = truncateFilename(name, maxChars);
    }

    // Grow to use all available space
    let wider = truncateFilename(name, maxChars + 1);
    while (maxChars < name.length && ctx.measureText(wider).width <= availableWidth) {
      maxChars++;
      truncated = wider;
      wider = truncateFilename(name, maxChars + 1);
    }

    this.displayText.set(truncated);
  }
}
