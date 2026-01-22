import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { Icon } from "@bitwarden/assets/svg";

import { IconModule } from "../icon";
import { TypographyModule } from "../typography";

/**
 * Hero section component for landing pages featuring an optional icon, title, and subtitle.
 *
 * @remarks
 * This component provides:
 * - Optional icon display (e.g., feature icons, status icons)
 * - Large title text with consistent typography
 * - Subtitle text for additional context
 * - Centered layout with proper spacing
 *
 * Use this component as the first child inside `bit-landing-content` to create a prominent
 * hero section that introduces the page's purpose.
 *
 * @example
 * ```html
 * <bit-landing-hero
 *   [icon]="lockIcon"
 *   [title]="'Secure Your Passwords'"
 *   [subtitle]="'Create your account to get started'"
 * ></bit-landing-hero>
 * ```
 */
@Component({
  selector: "bit-landing-hero",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-hero.component.html",
  imports: [IconModule, TypographyModule],
})
export class LandingHeroComponent {
  readonly icon = input<Icon | null>(null);
  readonly title = input<string | undefined>();
  readonly subtitle = input<string | undefined>();
}
