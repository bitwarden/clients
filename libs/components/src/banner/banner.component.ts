import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  input,
  output,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";
import { IconTileComponent, type IconTileVariant } from "../icon-tile/icon-tile.component";

import { BannerTitleDirective } from "./banner-title.directive";

export type BannerVariant = "primary" | "success" | "warning" | "danger";

// export type BannerSize = "lg" | "md";

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
 * - Banners can contain an anchor that uses the `bitLink` directive.
 */
@Component({
  selector: "bit-banner",
  templateUrl: "./banner.component.html",
  imports: [IconButtonModule, IconTileComponent, I18nPipe, BannerTitleDirective],
  host: {
    // Account for bit-layout's padding
    class:
      "tw-@container tw-flex tw-flex-col [bit-layout_&]:-tw-mx-8 [bit-layout_&]:-tw-my-6 [bit-layout_&]:tw-pb-6",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BannerComponent {
  /**
   * The variant of banner, which determines its color scheme.
   */
  readonly variant = input<BannerVariant>("primary");

  /**
   * The icon to display. If not provided, a default icon based on variant will be used.
   * Explicitly passing null will remove the icon.
   */
  readonly icon = input<string | null>();

  /**
   * Whether to show the close button.
   */
  readonly showClose = input(true);

  /**
   * Whether to use ARIA alert role for screen readers.
   */
  readonly useAlertRole = input(true);

  /**
   * Emitted when the banner is closed via the close button.
   */
  readonly onClose = output();

  /**
   * The computed icon to display, falling back to the default icon for the variant.
   */
  protected readonly displayIcon = computed(() => {
    if (this.icon() === null) {
      return null;
    }
    return this.icon() ?? defaultIcon[this.variant()];
  });

  /**
   * Icon tile variant matches banner variant.
   */
  protected readonly resolvedIconTileVariant = computed((): IconTileVariant => {
    const variantMap: Record<BannerVariant, IconTileVariant> = {
      primary: "primary",
      success: "success",
      warning: "warning",
      danger: "danger",
    };
    return variantMap[this.variant()];
  });

  protected readonly titleSlot = contentChild(BannerTitleDirective);

  /**
   * Actions slot only renders when a title is present.
   */
  protected readonly showActions = computed(() => !!this.titleSlot());

  protected readonly bannerClass = computed(() => {
    const align = this.showActions() ? "tw-items-start @5xl:tw-items-center" : "tw-items-center";

    switch (this.variant()) {
      case "primary":
        return `${align} tw-bg-bg-brand-softer tw-border-b-border-brand-soft`;
      case "success":
        return `${align} tw-bg-bg-success-soft tw-border-b-border-success-soft`;
      case "warning":
        return `${align} tw-bg-bg-warning-soft tw-border-b-border-warning-soft`;
      case "danger":
        return `${align} tw-bg-bg-danger-soft tw-border-b-border-danger-soft`;
    }
  });
}
