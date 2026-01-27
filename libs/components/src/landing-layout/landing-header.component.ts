import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { BitwardenLogo } from "@bitwarden/assets/svg";

import { IconModule } from "../icon";
import { SharedModule } from "../shared";

/**
 * Header component for landing pages with optional Bitwarden logo and header actions slot.
 *
 * @remarks
 * This component provides:
 * - Optional Bitwarden logo with link to home page (left-aligned)
 * - Default content projection slot for header actions (right-aligned, auto-margin left)
 * - Consistent header styling across landing pages
 * - Responsive layout that adapts logo size
 *
 * Use this component inside `bit-landing-layout` as the first child to position it at the top.
 * Content projected into this component will automatically align to the right side of the header.
 *
 * @example
 * ```html
 * <bit-landing-header [hideLogo]="false">
 *   <!-- Content here appears in the right-aligned actions slot -->
 *   <nav>
 *     <a routerLink="/login">Log in</a>
 *     <button type="button">Sign up</button>
 *   </nav>
 * </bit-landing-header>
 * ```
 */
@Component({
  selector: "bit-landing-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-header.component.html",
  imports: [RouterModule, IconModule, SharedModule],
})
export class LandingHeaderComponent {
  readonly hideLogo = input<boolean>(false);
  protected readonly logo = BitwardenLogo;
}
