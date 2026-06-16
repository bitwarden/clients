import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

export const LandingContentMaxWidth = ["md", "lg", "xl", "2xl", "3xl", "4xl"] as const;

export type LandingContentMaxWidthType = (typeof LandingContentMaxWidth)[number];

/**
 * Main content container for landing pages with configurable max-width constraints.
 *
 * @remarks
 * This component provides:
 * - Centered content area with alternative background color
 * - Configurable maximum width to control content readability
 * - Content projection slots for hero section and main content
 * - Responsive padding and layout
 *
 * Use this component inside `bit-landing-layout` to wrap your main page content.
 * Optionally include a `bit-landing-hero` as the first child for consistent hero section styling.
 *
 * @example
 * ```html
 * <bit-landing-content [maxWidth]="'xl'">
 *   <bit-landing-hero
 *     [icon]="lockIcon"
 *     [title]="'Welcome'"
 *     [subtitle]="'Get started with your account'"
 *   ></bit-landing-hero>
 *   <bit-landing-card>
 *     <!-- Your form or content here -->
 *   </bit-landing-card>
 * </bit-landing-content>
 * ```
 */
@Component({
  selector: "bit-landing-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-content.component.html",
  host: {
    class: "tw-grow tw-flex tw-flex-col",
  },
})
export class LandingContentComponent {
  /**
   * Max width of the landing layout container.
   *
   * @default "md"
   */
  readonly maxWidth = input<LandingContentMaxWidthType>("md");

  private readonly maxWidthClassMap: Record<LandingContentMaxWidthType, string> = {
    md: "tw-max-w-md",
    lg: "tw-max-w-lg",
    xl: "tw-max-w-xl",
    "2xl": "tw-max-w-2xl",
    "3xl": "tw-max-w-3xl",
    "4xl": "tw-max-w-4xl",
  };

  readonly maxWidthClasses = computed(() => {
    const maxWidthClass = this.maxWidthClassMap[this.maxWidth()];
    return `tw-flex tw-flex-col tw-w-full ${maxWidthClass}`;
  });
}
