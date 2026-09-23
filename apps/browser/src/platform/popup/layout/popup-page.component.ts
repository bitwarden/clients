import { CommonModule } from "@angular/common";
import { booleanAttribute, ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CollapseOnScrollDirective,
  IconModule,
  ScrollCollapseService,
  ScrollLayoutHostDirective,
} from "@bitwarden/components";

@Component({
  selector: "popup-page",
  templateUrl: "popup-page.component.html",
  host: {
    class: "tw-h-full tw-flex tw-flex-col tw-overflow-y-hidden",
  },
  imports: [CommonModule, IconModule, ScrollLayoutHostDirective, CollapseOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopupPageComponent {
  protected readonly i18nService = inject(I18nService);
  private readonly scrollCollapse = inject(ScrollCollapseService);

  readonly loading = input<boolean>(false);

  readonly disablePadding = input(false, { transform: booleanAttribute });

  /** Hides any overflow within the page content */
  readonly hideOverflow = input(false, { transform: booleanAttribute });

  /**
   * Collapse the `above-scroll-area` region while the user scrolls down. The scroll region below is
   * used by default; a page whose content owns its own scroller marks it `bitScrollCollapseSource`.
   */
  readonly collapseAboveScrollArea = input(false, { transform: booleanAttribute });

  /** Whether the page content has been scrolled away from the top. Read by `popup-header`. */
  readonly isScrolled = this.scrollCollapse.scrolled;

  /** Accessible loading label for the spinner. Defaults to "loading" */
  readonly loadingText = input<string | undefined>(this.i18nService.t("loading"));
}
