import { CommonModule } from "@angular/common";
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { filter, switchMap, fromEvent, startWith, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconModule, ScrollLayoutHostDirective, ScrollLayoutService } from "@bitwarden/components";

@Component({
  selector: "popup-page",
  templateUrl: "popup-page.component.html",
  host: {
    class: "tw-h-full tw-flex tw-flex-col tw-overflow-y-hidden",
  },
  imports: [CommonModule, IconModule, ScrollLayoutHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopupPageComponent {
  protected readonly i18nService = inject(I18nService);
  private readonly scrollLayout = inject(ScrollLayoutService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = input<boolean>(false);

  readonly disablePadding = input(false, { transform: booleanAttribute });

  /** Hides any overflow within the page content */
  readonly hideOverflow = input(false, { transform: booleanAttribute });

  /**
   * Makes the scroll region a full-height flex column so projected content can size itself against
   * it. Needed by content that manages its own scrolling (e.g. a `height="fill"` table): without a
   * flex parent such content has no bounded height to grow into and collapses to zero.
   */
  readonly fillContent = input(false, { transform: booleanAttribute });

  protected readonly scrolled = signal(false);
  readonly isScrolled = this.scrolled.asReadonly();

  private readonly aboveScrollArea = viewChild<ElementRef<HTMLElement>>("aboveScrollArea");

  /**
   * Whether the above-scroll-area slot renders anything, so the container can drop its padding and
   * border when it doesn't.
   *
   * Measured rather than counted: components projected into the slot (banners, callouts) generally
   * render an always-present host element and decide internally whether to show content, so a child
   * count is non-zero even when nothing is visible.
   *
   * The *children* are measured, not the container — the container's own vertical padding counts
   * toward its `scrollHeight`, so it reports a non-zero height even while empty.
   */
  protected readonly aboveScrollAreaHasContent = signal(false);

  private readonly _measureAboveScrollArea = afterRenderEffect((onCleanup) => {
    const el = this.aboveScrollArea()?.nativeElement;
    if (!el) {
      return;
    }

    const measure = () =>
      this.aboveScrollAreaHasContent.set(
        Array.from(el.children).some((child) => (child as HTMLElement).offsetHeight > 0),
      );

    // Slot content usually appears once an observable resolves, so re-measure as children resize.
    // Observing the children (not the container) also keeps the container's own padding changes
    // from feeding back into the measurement.
    const resizeObserver = new ResizeObserver(measure);

    const observeChildren = () => {
      resizeObserver.disconnect();
      Array.from(el.children).forEach((child) => resizeObserver.observe(child));
      measure();
    };

    observeChildren();

    // Consumers add and remove projected elements over the page's life, so keep the set of
    // observed children in sync rather than binding to whichever ones existed at first render.
    const mutationObserver = new MutationObserver(observeChildren);
    mutationObserver.observe(el, { childList: true });

    onCleanup(() => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    });
  });

  constructor() {
    this.scrollLayout.scrollableRef$
      .pipe(
        filter((ref): ref is ElementRef<HTMLElement> => ref != null),
        switchMap((ref) =>
          fromEvent(ref.nativeElement, "scroll").pipe(
            startWith(null),
            map(() => ref.nativeElement.scrollTop !== 0),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((isScrolled) => this.scrolled.set(isScrolled));
  }

  /** Accessible loading label for the spinner. Defaults to "loading" */
  readonly loadingText = input<string | undefined>(this.i18nService.t("loading"));
}
