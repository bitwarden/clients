import { CommonModule } from "@angular/common";
import { Component, HostBinding, Input, booleanAttribute } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() size: "fill" | "small" | "large" = "large";

  /**
   * Disable the default color of the spinner, inherits the text color.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: booleanAttribute }) noColor = false;

  /**
   * Accessibility title. Defaults to `Loading`.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() title = this.i18nService.t("loading");

  /**
   * Display text for screen readers.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: booleanAttribute }) sr = true;

  @HostBinding("class") get classList() {
    return ["tw-inline-block", "tw-overflow-hidden", "tw-flex", "tw-items-center"]
      .concat(this.sizeClass)
      .concat([this.noColor ? "" : "tw-text-primary-600"]);
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
