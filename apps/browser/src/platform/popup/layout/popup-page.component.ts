import { CommonModule } from "@angular/common";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { filter, switchMap, fromEvent, startWith, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ScrollLayoutHostDirective, ScrollLayoutService } from "@bitwarden/components";

@Component({
  selector: "popup-page",
  templateUrl: "popup-page.component.html",
  host: {
    class: "tw-h-full tw-flex tw-flex-col tw-overflow-y-hidden",
  },
  imports: [CommonModule, ScrollLayoutHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopupPageComponent {
  protected i18nService = inject(I18nService);
  private scrollLayout = inject(ScrollLayoutService);
  private destroyRef = inject(DestroyRef);

  readonly loading = input<boolean>(false);

  readonly disablePadding = input(false, { transform: booleanAttribute });

  /** Hides any overflow within the page content */
  readonly hideOverflow = input(false, { transform: booleanAttribute });

  protected readonly scrolled = signal(false);
  isScrolled = this.scrolled.asReadonly();

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
