import { CommonModule } from "@angular/common";
import { booleanAttribute, Component, inject, input, signal } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ScrollLayoutHostDirective } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "popup-page",
  templateUrl: "popup-page.component.html",
  host: {
    class: "tw-h-full tw-flex tw-flex-col tw-overflow-y-hidden",
  },
  imports: [CommonModule, ScrollLayoutHostDirective],
})
export class PopupPageComponent {
  protected i18nService = inject(I18nService);

  readonly loading = input<boolean>(false);

  readonly disablePadding = input(false, { transform: booleanAttribute });

  /** Hides any overflow within the page content */
  readonly hideOverflow = input(false, { transform: booleanAttribute });

  protected readonly scrolled = signal(false);
  isScrolled = this.scrolled.asReadonly();

  /** Accessible loading label for the spinner. Defaults to "loading" */
  readonly loadingText = input<string | undefined>(this.i18nService.t("loading"));

  handleScroll(event: Event) {
    this.scrolled.set((event.currentTarget as HTMLElement).scrollTop !== 0);
  }
}
