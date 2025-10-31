import { CommonModule } from "@angular/common";
import { Component, OnInit, Output, EventEmitter, input, model } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";

type BannerType = "premium" | "info" | "warning" | "danger";

const defaultIcon: Record<BannerType, string> = {
  premium: "bwi-star",
  info: "bwi-info-circle",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
};
/**
  * Banners are used for important communication with the user that needs to be seen right away, but has
  * little effect on the experience. Banners appear at the top of the user's screen on page load and
  * persist across all pages a user navigates to.

  * - They should always be dismissible and never use a timeout. If a user dismisses a banner, it should not reappear during that same active session.
  * - Use banners sparingly, as they can feel intrusive to the user if they appear unexpectedly. Their effectiveness may decrease if too many are used.
  * - Avoid stacking multiple banners.
  * - Banners can contain a button or anchor that uses the `bitLink` directive with `linkType="secondary"`.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-banner",
  templateUrl: "./banner.component.html",
  imports: [CommonModule, IconButtonModule, I18nPipe],
  host: {
    // Account for bit-layout's padding
    class:
      "tw-flex tw-flex-col [bit-layout_&]:-tw-mx-8 [bit-layout_&]:-tw-my-6 [bit-layout_&]:tw-pb-6",
  },
})
export class BannerComponent implements OnInit {
  readonly bannerType = input<BannerType>("info");

  // passing `null` will remove the icon from element from the banner
  readonly icon = model<string | null>();
  readonly useAlertRole = input(true);
  readonly showClose = input(true);

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onClose = new EventEmitter<void>();

  ngOnInit(): void {
    if (!this.icon() && this.icon() !== null) {
      this.icon.set(defaultIcon[this.bannerType()]);
    }
  }

  get bannerClass() {
    switch (this.bannerType()) {
      case "danger":
        return "tw-bg-danger-100 tw-border-b-danger-700";
      case "info":
        return "tw-bg-info-100 tw-border-b-info-700";
      case "premium":
        return "tw-bg-success-100 tw-border-b-success-700";
      case "warning":
        return "tw-bg-warning-100 tw-border-b-warning-700";
    }
  }
}
