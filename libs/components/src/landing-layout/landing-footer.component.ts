import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { ContentVerticalPaddingType } from "./landing-content.component";
import { LANDING_FOOTER_VERTICAL_PADDING_DEFAULT } from "./landing-defaults";

/**
 * Footer component for landing pages.
 *
 * @remarks
 * This component provides:
 * - Content projection for custom footer content (e.g., links, copyright, legal)
 * - Consistent footer positioning at the bottom of the page
 * - Proper z-index to appear above background illustrations
 *
 * Use this component inside `bit-landing-layout` as the last child to position it at the bottom.
 *
 * @example
 * ```html
 * <bit-landing-footer>
 *   <div class="tw-text-center tw-text-sm">
 *     <a routerLink="/privacy">Privacy</a>
 *     <span>© 2024 Bitwarden</span>
 *   </div>
 * </bit-landing-footer>
 * ```
 */
@Component({
  selector: "bit-landing-footer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-footer.component.html",
})
export class LandingFooterComponent {
  /**
   * Vertical padding of the footer. Defaults to "default".
   *
   * "compact" reduces the vertical padding.
   */
  readonly footerVerticalPadding = input<ContentVerticalPaddingType>(
    LANDING_FOOTER_VERTICAL_PADDING_DEFAULT,
  );

  protected readonly paddingClasses = computed(() =>
    this.footerVerticalPadding() === "compact" ? "tw-px-5 tw-py-3" : "tw-p-5 tw-pt-4 sm:tw-pt-6",
  );
}
