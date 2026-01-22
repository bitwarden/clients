import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

export const LandingContentMaxWidth = {
  Md: "md",
  Lg: "lg",
  Xl: "xl",
  "2Xl": "2xl",
  "3Xl": "3xl",
  "4Xl": "4xl",
} as const;

export type LandingContentMaxWidthType =
  (typeof LandingContentMaxWidth)[keyof typeof LandingContentMaxWidth];

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
   * @default LandingContentMaxWidth.Md
   */
  readonly maxWidth = input<LandingContentMaxWidthType>(LandingContentMaxWidth.Md);

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
