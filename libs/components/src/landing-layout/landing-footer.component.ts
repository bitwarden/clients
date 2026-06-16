import { ChangeDetectionStrategy, Component } from "@angular/core";

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
export class LandingFooterComponent {}
