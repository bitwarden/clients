import { CommonModule } from "@angular/common";
import { Component, HostBinding, Input, booleanAttribute } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Component({
  selector: "bit-spinner",
  templateUrl: "spinner.component.html",
  standalone: true,
  imports: [CommonModule],
})
export class SpinnerComponent {
  /**
   * The size of the spinner. Defaults to `large`.
   */
  @Input() size: "fill" | "small" | "large" = "large";

  /**
   * Disable the default color of the spinner, inherits the text color.
   */
  @Input({ transform: booleanAttribute }) noColor = false;

  /**
   * Accessibility title. Defaults to `Loading`.
   */
  @Input() title = this.i18nService.t("loading");

  /**
   * Display text for screen readers.
   */
  @Input({ transform: booleanAttribute }) sr = true;

  @HostBinding("class") get classList() {
    return ["tw-inline-block", "tw-overflow-hidden", "tw-flex", "tw-items-center"]
      .concat(this.sizeClass)
      .concat([this.noColor ? null : "tw-text-primary-600"]);
  }

  constructor(private i18nService: I18nService) {}

  get sizeClass() {
    switch (this.size) {
      case "small":
        return ["tw-h-4"];
      case "large":
        return ["tw-h-16"];
      default:
        return ["tw-h-full", "tw-w-full"];
    }
  }
}
