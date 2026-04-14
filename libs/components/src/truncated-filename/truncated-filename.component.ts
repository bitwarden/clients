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
 * Shared ResizeObserver instance for all TruncatedFilenameComponent instances.
 * A single observer watching N elements is more efficient than N separate observers.
 */
let sharedObserver: ResizeObserver | null = null;
const observedElements = new WeakMap<Element, () => void>();

function observeResize(el: Element, callback: () => void): void {
  if (typeof ResizeObserver === "undefined") {
    return;
  }
  if (!sharedObserver) {
    sharedObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        observedElements.get(entry.target)?.();
      }
    });
  }
  observedElements.set(el, callback);
  sharedObserver.observe(el);
}

function unobserveResize(el: Element): void {
  sharedObserver?.unobserve(el);
  observedElements.delete(el);
}

/** Shared offscreen canvas for text measurement across all instances. */
let sharedCanvas: HTMLCanvasElement | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
  }
  return sharedCanvas.getContext("2d");
}

/**
 * Renders a filename with responsive middle-truncation that preserves the file extension.
 *
 * Measures the available container width via a shared `ResizeObserver` and uses canvas text
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

    observeResize(el, () => this.recalculate());
    this.recalculate();

    this.destroyRef.onDestroy(() => {
      unobserveResize(el);
    });
  }

  ngOnDestroy(): void {
    const el = this.containerRef()?.nativeElement;
    if (el) {
      unobserveResize(el);
    }
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

    const ctx = getMeasureContext();
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
}
