import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { BitSvg } from "@bitwarden/assets/svg";

import { SvgModule } from "../svg";
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
  imports: [SvgModule, TypographyModule],
})
export class LandingHeroComponent {
  readonly icon = input<BitSvg | null>(null);
  readonly title = input<string | undefined>();
  readonly subtitle = input<string | undefined>();

  /**
   * Horizontal alignment of the hero (icon, title, subtitle). Defaults to "center".
   *
   * "left" produces a left-aligned hero (no `tw-mx-auto`, no `tw-text-center`).
   */
  readonly heroAlignment = input<"left" | "center">("center");

  // Migration shim: see AnonLayoutComponent for context. Step 10 removes both the
  // `adjustedLayout` input and the effective computed below.
  readonly adjustedLayout = input<boolean>(false);

  protected readonly effectiveHeroAlignment = computed<"left" | "center">(() =>
    this.adjustedLayout() ? "left" : this.heroAlignment(),
  );

  protected readonly alignmentClasses = computed(() =>
    this.effectiveHeroAlignment() === "left" ? "tw-text-left" : "tw-text-center tw-mx-auto",
  );
}
