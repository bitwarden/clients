import { ChangeDetectionStrategy, Component, input } from "@angular/core";

export const LandingContainerMaxWidth = {
  Md: "md",
  Lg: "lg",
  Xl: "xl",
  _2Xl: "2xl",
  _3Xl: "3xl",
  _4Xl: "4xl",
} as const;

export type LandingContainerMaxWidthType =
  (typeof LandingContainerMaxWidth)[keyof typeof LandingContainerMaxWidth];

@Component({
  selector: "bit-landing-max-width-container",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  host: {
    "[class]": "classList",
  },
})
export class LandingMaxWidthContainerComponent {
  /**
   * Max width of the anon layout title, subtitle, and content areas.
   *
   * @default LandingContainerMaxWidth.Md
   */
  readonly maxWidth = input<LandingContainerMaxWidthType>(LandingContainerMaxWidth.Md);

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
