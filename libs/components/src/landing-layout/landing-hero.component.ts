import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { BitSvg } from "@bitwarden/assets/svg";

import { SvgModule } from "../svg";
import { TypographyModule } from "../typography";

import { LANDING_HERO_TEXT_ALIGNMENT_DEFAULT } from "./landing-defaults";

export type HeroTextAlignmentType = "left" | "center";

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
  imports: [SvgModule, TypographyModule],
})
export class LandingHeroComponent {
  readonly icon = input<BitSvg | null>(null);
  readonly title = input<string | undefined>();
  readonly subtitle = input<string | undefined>();

  /**
   * Horizontal alignment of the hero's title and subtitle. Defaults to "center".
   * (The icon is always centered. Pair with `hidePageIcon: true` for a fully
   * left-aligned hero block.)
   */
  readonly heroTextAlignment = input<HeroTextAlignmentType>(LANDING_HERO_TEXT_ALIGNMENT_DEFAULT);

  protected readonly alignmentClasses = computed(() =>
    this.heroTextAlignment() === "left" ? "tw-text-left" : "tw-text-center tw-mx-auto",
  );
}
