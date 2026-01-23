import { Component, ChangeDetectionStrategy, inject, input } from "@angular/core";

import { BackgroundLeftIllustration, BackgroundRightIllustration } from "@bitwarden/assets/svg";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { IconModule } from "../icon";

/**
 * Root layout component for landing pages providing a full-screen container with optional decorative background illustrations.
 *
 * @remarks
 * This component serves as the outermost wrapper for landing pages and provides:
 * - Full-screen layout that adapts to different client types (web, browser, desktop)
 * - Optional decorative background illustrations in the bottom corners
 * - Content projection slots for header, main content, and footer
 *
 * @example
 * ```html
 * <bit-landing-layout [hideBackgroundIllustration]="false">
 *   <bit-landing-header>...</bit-landing-header>
 *   <bit-landing-content>...</bit-landing-content>
 *   <bit-landing-footer>...</bit-landing-footer>
 * </bit-landing-layout>
 * ```
 */
@Component({
  selector: "bit-landing-layout",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-layout.component.html",
  imports: [IconModule],
})
export class LandingLayoutComponent {
  readonly hideBackgroundIllustration = input<boolean>(false);

  protected readonly leftIllustration = BackgroundLeftIllustration;
  protected readonly rightIllustration = BackgroundRightIllustration;

  private readonly platformUtilsService: PlatformUtilsService = inject(PlatformUtilsService);
  protected readonly clientType = this.platformUtilsService.getClientType();
}
