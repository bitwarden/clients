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

    const fullWidth = Math.round(ctx.measureText(name).width);
    if (fullWidth <= availableWidth) {
      this.displayText.set(name);
      return;
    }

    // Estimate max chars from average character width, then verify it fits
    const avgCharWidth = fullWidth / name.length;
    let maxChars = Math.max(5, Math.floor(availableWidth / avgCharWidth));
    let truncated = truncateFilename(name, maxChars);

    while (ctx.measureText(truncated).width > availableWidth && maxChars > 5) {
      maxChars--;
      truncated = truncateFilename(name, maxChars);
    }

    this.displayText.set(truncated);
  }

  /** Shared offscreen canvas for text measurement across all instances. */
  private static readonly measureCanvas: HTMLCanvasElement = document.createElement("canvas");

  private static getMeasureContext(): CanvasRenderingContext2D | null {
    return TruncatedFilenameComponent.measureCanvas.getContext("2d");
  }
}
