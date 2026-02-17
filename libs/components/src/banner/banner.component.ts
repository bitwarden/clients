import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";
import { IconTileComponent, type IconTileVariant } from "../icon-tile/icon-tile.component";

type BannerVariant = "primary" | "success" | "warning" | "danger";

const defaultIcon: Record<BannerVariant, string> = {
  primary: "bwi-info-circle",
  success: "bwi-star",
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
  imports: [IconButtonModule, IconTileComponent, I18nPipe],
  host: {
    // Account for bit-layout's padding
    class:
      "tw-flex tw-flex-col [bit-layout_&]:-tw-mx-8 [bit-layout_&]:-tw-my-6 [bit-layout_&]:tw-pb-6",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BannerComponent {
  /**
   * The variant of banner, which determines its color scheme.
   */
  readonly variant = input<BannerVariant>("primary");

  /**
   * The size of the banner.
   */
  readonly size = input<"lg" | "md">("lg");

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
    return this.icon() ?? defaultIcon[this.variant()];
  });

  /**
   * Icon tile size is always "sm" (24px) for simple banner
   */
  protected readonly iconTileSize = computed(() => "sm" as const);

  /**
   * Icon tile variant matches banner variant
   */
  protected readonly iconTileVariant = computed((): IconTileVariant => {
    const variantMap: Record<BannerVariant, IconTileVariant> = {
      primary: "primary",
      success: "success",
      warning: "warning",
      danger: "danger",
    };
    return variantMap[this.variant()];
  });

  protected readonly bannerClass = computed(() => {
    switch (this.variant()) {
      case "primary":
        return "tw-bg-info-100 tw-border-b-info-700";
      case "success":
        return "tw-bg-success-100 tw-border-b-success-700";
      case "warning":
        return "tw-bg-warning-100 tw-border-b-warning-700";
      case "danger":
        return "tw-bg-danger-100 tw-border-b-danger-700";
    }
  });

  protected readonly sizeClasses = computed(() => {
    switch (this.size()) {
      case "lg":
        return "tw-h-14 tw-p-4"; // 56px height, 16px padding
      case "md":
        return "tw-h-10 tw-py-2 tw-px-4"; // 40px height, 8px vertical, 16px horizontal
    }
  });
}
