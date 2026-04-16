import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  inject,
  input,
  signal,
  afterNextRender,
  viewChild,
  viewChildren,
  ElementRef,
  DestroyRef,
} from "@angular/core";
import { RouterModule } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { IconModule } from "../icon";
import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { MenuModule } from "../menu";
import { TypographyModule } from "../typography";

import { BreadcrumbComponent } from "./breadcrumb.component";

const ARROW_SPACER = 44; // The horizontal space taken up by the arrow between breadcrumbs, in pixels

/**
 * Breadcrumbs are used to help users understand where they are in a products navigation. Typically
 * Bitwarden uses this component to indicate the user's current location in a set of data organized in
 * containers (Collections, Folders, or Projects).
 */
@Component({
  selector: "bit-breadcrumbs",
  templateUrl: "./breadcrumbs.component.html",
  imports: [
    I18nPipe,
    CommonModule,
    LinkModule,
    RouterModule,
    IconModule,
    IconButtonModule,
    MenuModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-items-center",
    role: "navigation",
    "[attr.aria-label]": "ariaLabel",
  },
})
export class BreadcrumbsComponent {
  private readonly i18nService = inject(I18nService);
  protected readonly ariaLabel = this.i18nService.t("breadcrumbs");
  private readonly resizeObserver: ResizeObserver;
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostElement = inject(ElementRef);
  private readonly hostElementWidth = signal(0);
  private readonly moreButton = viewChild.required("moreButton", { read: ElementRef });
  private readonly breadcrumbItems = viewChildren<ElementRef>("breadcrumbEl");
  private readonly moreButtonWidth = signal(0);

  /** Whether the breadcrumbs have been rendered. Used to hide or display breadcrumbs container, preventing layout shifts. */
  protected readonly breadcrumbsRendered = signal(false);

  /** Cached breadcrumb widths measured before any hiding, keyed by index. */
  private readonly breadcrumbWidths = signal<number[]>([]);

  /**
   * The maximum number of breadcrumbs to show before overflow.
   */
  readonly show = input(4);

  /**
   * The size of the breadcrumb text and icons. Defaults to "base" size.
   */
  readonly size = input<"small" | "base">("base");

  protected readonly breadcrumbs = contentChildren(BreadcrumbComponent);

  /** The last and active breadcrumb, shown after the overflow menu */
  protected readonly lastBreadcrumb = computed(() => this.breadcrumbs().at(-1));

  /** Determines which breadcrumbs are displayed and which overflow into the "More" menu.
   * Excludes the last/active breadcrumb since that is always shown.
   * */
  protected readonly sortedBreadcrumbs = computed(() => {
    const allBreadcrumbs = this.breadcrumbs().map((_, i) => i);

    if (!this.breadcrumbsRendered()) {
      return { displayed: allBreadcrumbs.slice(0, -1), overflow: [] as number[] };
    }

    const breadcrumbWidths = this.breadcrumbWidths();
    const containerWidth = this.hostElementWidth();

    // Total width of all breadcrumbs including gaps
    const totalBreadcrumbWidth = breadcrumbWidths.reduce(
      (sum, w, i) => sum + w + (i > 0 ? ARROW_SPACER : 0),
      0,
    );

    // If all breadcrumbs fit without the more button, no overflow needed
    if (totalBreadcrumbWidth <= containerWidth) {
      return { displayed: allBreadcrumbs.slice(0, -1), overflow: [] as number[] };
    }

    const displayed: number[] = []; // Store indexes of breadcrumbs that are displayed
    const overflow: number[] = []; // Store indexes of breadcrumbs that are in the "More" overflow menu

    // Reserve space for the more button and the last/active breadcrumb.
    const moreButtonWidth = this.moreButtonWidth();
    const activeBreadcrumbWidth = breadcrumbWidths.at(-1) ?? 0;
    const firstBreadcrumbWidth = this.breadcrumbWidths()[0]
      ? this.breadcrumbWidths()[0] + ARROW_SPACER
      : 0;

    const availableWidth =
      containerWidth - moreButtonWidth - activeBreadcrumbWidth - firstBreadcrumbWidth;

    let totalWidth = 0;
    for (let i = allBreadcrumbs.length - 2; i > 0; i--) {
      const breadcrumbWidth = (breadcrumbWidths[i] ?? 0) + ARROW_SPACER;
      if (totalWidth + breadcrumbWidth > availableWidth) {
        overflow.push(...allBreadcrumbs.slice(1, i + 1)); // Move remaining breadcrumbs (except the first) to overflow
        displayed.unshift(0); // Add the first breadcrumb to displayed
        break;
      }
      totalWidth += breadcrumbWidth;
      displayed.unshift(i);
    }

    if (
      overflow.length === allBreadcrumbs.length - 2 &&
      totalWidth + firstBreadcrumbWidth > availableWidth
    ) {
      // If the first breadcrumb alone exceeds available space, move it to overflow as well
      displayed.pop();
      overflow.unshift(0);
    }

    if (displayed.length + 1 > this.show()) {
      // If there are more breadcrumbs than the "show" limit, move extras to overflow starting from the left (after the first)
      const overflowCount = displayed.length + 1 - this.show();
      const overflowItems = displayed.splice(1, overflowCount); // Always keep the first breadcrumb visible if possible
      overflow.push(...overflowItems);
    }

    // Truncate the last breadcrumb if there are overflowed breadcrumbs
    const truncateBreadcrumb = displayed.length === 0 && overflow.length > 0 && availableWidth < 0;

    return { displayed, overflow, truncateBreadcrumb };
  });

  constructor() {
    this.resizeObserver = new ResizeObserver(this.measureHostElementWidth);

    afterNextRender(() => {
      // Measure breadcrumb widths and more button width after fonts have loaded to ensure accurate measurements
      void document.fonts.ready.then(() => {
        this.measureHostElementWidth();
        this.measureMoreButtonWidth();
        this.measureBreadcrumbWidths();
        this.breadcrumbsRendered.set(true);
      });
      this.resizeObserver.observe(this.hostElement.nativeElement);
      this.destroyRef.onDestroy(() => this.resizeObserver.disconnect());
    });
  }

  /** Calculates and sets the width of the host element */
  private readonly measureHostElementWidth = (entries?: ResizeObserverEntry[]) => {
    const headerEl = this.hostElement.nativeElement;
    const contentWidth = entries
      ? entries[0].contentBoxSize[0].inlineSize
      : headerEl.getBoundingClientRect().width;

    if (contentWidth !== this.hostElementWidth()) {
      this.hostElementWidth.set(contentWidth);
    }
  };

  /**
   * Measures the widths of all breadcrumbs and stores them in the `breadcrumbWidths` signal.
   * This is used to determine how many breadcrumbs can fit in the available space before
   * overflowing into the "More" menu.
   */
  private readonly measureBreadcrumbWidths = () => {
    this.breadcrumbWidths.set(
      this.breadcrumbItems()
        // Round up to prevent edge case overflow when breadcrumb width is close to available space
        .map((item) => Math.ceil(item.nativeElement.getBoundingClientRect().width)),
    );
  };

  /**
   * Measures the width of the "More" button and stores it in the `moreButtonWidth` signal.
   * This is used to determine how many breadcrumbs can fit in the available space before
   * overflowing into the "More" menu.
   */
  private readonly measureMoreButtonWidth = (entries?: ResizeObserverEntry[]): void => {
    const moreButtonEl = this.moreButton().nativeElement;

    if (entries != null) {
      // Called by ResizeObserver — button is visible, read directly from entries
      this.moreButtonWidth.set(entries[0].contentBoxSize[0].inlineSize + ARROW_SPACER);
      return;
    }

    // Called manually (init / fonts loaded) — button may be hidden, temporarily show it
    const wasHidden = moreButtonEl.hidden;
    if (wasHidden) {
      moreButtonEl.hidden = false;
      // Force style recalculation before measuring, as getBoundingClientRect()
      // may return stale dimensions if styles haven't been flushed yet.
      void window.getComputedStyle(moreButtonEl).width;
    }

    this.moreButtonWidth.set(moreButtonEl.getBoundingClientRect().width + ARROW_SPACER);

    // Hide the more button again if it was originally hidden
    if (wasHidden) {
      moreButtonEl.hidden = true;
    }
  };

  protected readonly baseStyles = [
    "tw-inline-block",
    "tw-whitespace-nowrap",
    "!tw-m-0",
    "focus-visible:!tw-text-fg-brand",
    "focus-visible:!tw-rounded",
    "focus-visible:tw-outline-none",
    "focus-visible:tw-ring-2",
    "focus-visible:tw-ring-border-focus",
  ];

  protected readonly breadcrumbStyles = [
    ...this.baseStyles,
    "!tw-text-fg-body",
    "hover:!tw-text-fg-brand",
  ];

  protected readonly activeBreadcrumbStyles = [...this.baseStyles, "!tw-text-fg-heading"];
}
