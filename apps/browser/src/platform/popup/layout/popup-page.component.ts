import { CommonModule } from "@angular/common";
import { booleanAttribute, Component, inject, Input, signal } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Component({
  selector: "popup-page",
  templateUrl: "popup-page.component.html",
  standalone: true,
  host: {
    class: "tw-h-full tw-flex tw-flex-col tw-overflow-y-hidden",
  },
  imports: [CommonModule],
})
export class PopupPageComponent {
  protected i18nService = inject(I18nService);

  @Input() loading = false;

  @Input({ transform: booleanAttribute })
  disablePadding = false;

  protected scrolled = signal(false);
  isScrolled = this.scrolled.asReadonly();

  /** Accessible loading label for the spinner. Defaults to "loading" */
  @Input() loadingText?: string = this.i18nService.t("loading");

  handleScroll(event: Event) {
    this.scrolled.set((event.currentTarget as HTMLElement).scrollTop !== 0);
  }
}
