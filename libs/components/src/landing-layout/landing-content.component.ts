import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

export const LandingContentMaxWidth = ["md", "lg", "xl", "2xl", "3xl", "4xl"] as const;

export type LandingContentMaxWidthType = (typeof LandingContentMaxWidth)[number];

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
