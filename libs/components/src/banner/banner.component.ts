import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

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
 *
 * - They should always be dismissible and never use a timeout. If a user dismisses a banner, it should not reappear during that same active session.
 * - Use banners sparingly, as they can feel intrusive to the user if they appear unexpectedly. Their effectiveness may decrease if too many are used.
 * - Avoid stacking multiple banners.
 * - Banners can contain a button or anchor that uses the `bitLink` directive with `linkType="secondary"`.
 */
@Component({
  selector: "bit-banner",
  templateUrl: "./banner.component.html",
  imports: [IconButtonModule, I18nPipe],
  host: {
    // Account for bit-layout's padding
    class:
      "tw-flex tw-flex-col [bit-layout_&]:-tw-mx-8 [bit-layout_&]:-tw-my-6 [bit-layout_&]:tw-pb-6",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BannerComponent {
  /**
   * The type of banner, which determines its color scheme.
   */
  readonly bannerType = input<BannerType>("info");

  /**
   * The icon to display. If not provided, a default icon based on bannerType will be used. Explicitly passing null will remove the icon.
   */
  readonly icon = input<string | null>();

  /**
   * Whether to use ARIA alert role for screen readers.
   */
  readonly useAlertRole = input(true);

  /**
   * Whether to show the close button.
   */
  readonly showClose = input(true);

  /**
   * Emitted when the banner is closed via the close button.
   */
  readonly onClose = output();

  /**
   * The computed icon to display, falling back to the default icon for the banner type.
   * Returns null if icon is explicitly set to null (to hide the icon).
   */
  protected readonly displayIcon = computed(() => {
    // If icon is explicitly null, don't show any icon
    if (this.icon() === null) {
      return null;
    }

    // If icon is undefined, fall back to default icon
    return this.icon() ?? defaultIcon[this.bannerType()];
  });

  protected readonly bannerClass = computed(() => {
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
  });
}
