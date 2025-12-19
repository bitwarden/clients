import { ChangeDetectionStrategy, Component, input } from "@angular/core";

export const LandingContentMaxWidth = {
  Md: "md",
  Lg: "lg",
  Xl: "xl",
  _2Xl: "2xl",
  _3Xl: "3xl",
  _4Xl: "4xl",
} as const;

export type LandingContentMaxWidthType =
  (typeof LandingContentMaxWidth)[keyof typeof LandingContentMaxWidth];

@Component({
  selector: "bit-landing-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-content.component.html",
})
export class LandingContentComponent {
  /**
   * Max width of the anon layout title, subtitle, and content areas.
   *
   * @default LandingContentMaxWidth.Md
   */
  readonly maxWidth = input<LandingContentMaxWidthType>(LandingContentMaxWidth.Md);

  get maxWidthClass(): string {
    const maxWidth = this.maxWidth();
    switch (maxWidth) {
      case "md":
        return "tw-max-w-md";
      case "lg":
        return "tw-max-w-lg";
      case "xl":
        return "tw-max-w-xl";
      case "2xl":
        return "tw-max-w-2xl";
      case "3xl":
        return "tw-max-w-3xl";
      case "4xl":
        return "tw-max-w-4xl";
    }
  }
}
