import { ChangeDetectionStrategy, Component, input } from "@angular/core";

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
    "[class]": "classList",
  },
})
export class LandingContentComponent {
  /**
   * Max width of the landing layout container.
   *
   * @default LandingContentMaxWidth.Md
   */
  readonly maxWidth = input<LandingContentMaxWidthType>(LandingContentMaxWidth.Md);

  get classList(): string {
    const maxWidth = this.maxWidth();
    let maxWidthClass = "";

    switch (maxWidth) {
      case "md":
        maxWidthClass = "tw-max-w-md";
        break;
      case "lg":
        maxWidthClass = "tw-max-w-lg";
        break;
      case "xl":
        maxWidthClass = "tw-max-w-xl";
        break;
      case "2xl":
        maxWidthClass = "tw-max-w-2xl";
        break;
      case "3xl":
        maxWidthClass = "tw-max-w-3xl";
        break;
      case "4xl":
        maxWidthClass = "tw-max-w-4xl";
        break;
    }

    return `tw-flex tw-flex-col ${maxWidthClass}`;
  }
}
