import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
} from "@angular/core";

import { ResizeObserverDirective } from "../resize-observer";
import { TooltipDirective } from "../tooltip";
import { truncateFilename } from "../utils";

/**
 * Renders a filename with responsive middle-truncation that preserves the file extension.
 *
 * Uses `ResizeObserverDirective` to detect container width changes and canvas text
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
      resizeObserver
      (resize)="onResize()"
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
  imports: [ResizeObserverDirective, TooltipDirective],
})
export class TruncatedFilenameComponent {
  /** The full filename to display. */
  readonly filename = input.required<string>();

  /** The computed display text (full or middle-truncated). */
  protected readonly displayText = signal("");

  private readonly containerRef = viewChild<ElementRef<HTMLElement>>("container");

  constructor() {
    effect(() => {
      this.filename();
      this.recalculate();
    });
  }

  protected onResize(): void {
    this.recalculate();
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

    const ctx = TruncatedFilenameComponent.getMeasureContext();
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

    // Binary search for the largest maxChars where truncated text fits
    let lo = 5;
    let hi = name.length - 1;
    let best = lo;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = truncateFilename(name, mid);
      if (ctx.measureText(candidate).width <= availableWidth) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    this.displayText.set(truncateFilename(name, best));
  }

  /** Shared offscreen canvas for text measurement across all instances. */
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private static measureCanvas: HTMLCanvasElement | null = null;

  private static getMeasureContext(): CanvasRenderingContext2D | null {
    TruncatedFilenameComponent.measureCanvas ??= document.createElement("canvas");
    return TruncatedFilenameComponent.measureCanvas.getContext("2d");
  }
}
