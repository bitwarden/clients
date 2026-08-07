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
  NgZone,
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
  private readonly ngZone = inject(NgZone);

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
   * The children's combined bounding box is measured, not the container's — the container's own
   * vertical padding counts toward its height, so it never reports as empty.
   */
  protected readonly aboveScrollAreaHasContent = signal(false);

  private readonly _measureAboveScrollArea = afterRenderEffect((onCleanup) => {
    const el = this.aboveScrollArea()?.nativeElement;
    if (!el) {
      return;
    }

    // `getBoundingClientRect` reports a real box for inline elements, which `offsetHeight` and
    // ResizeObserver's content-box do not — projected hosts are `display: inline` unless they opt
    // out, so anything keying off those would miss their content entirely.
    //
    // Observer callbacks fire outside Angular's zone, so the write is run back inside it —
    // otherwise the signal updates but nothing schedules the re-render that acts on it.
    const measure = () =>
      this.ngZone.run(() =>
        this.aboveScrollAreaHasContent.set(
          Array.from(el.children).some((child) => child.getBoundingClientRect().height > 0),
        ),
      );

    measure();

    // Slot content typically appears asynchronously, once an observable resolves. `subtree` and
    // `characterData` matter because that content usually arrives *inside* an already-projected
    // host rather than as a new child of the container. ResizeObserver is not used here: it never
    // reports for non-replaced inline elements, which is what those hosts are.
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Mutations cover content appearing and disappearing; a resize on the container catches the
    // rest (viewport/compact-mode changes reflowing existing content). Observing the container is
    // safe for this purpose because the measurement reads the children, not the container.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);

    onCleanup(() => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
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
