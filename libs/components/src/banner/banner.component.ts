import { ChangeDetectionStrategy, Component, OnInit, computed, input, signal } from "@angular/core";
import { outputFromObservable } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";
import { IconTileComponent } from "../icon-tile/icon-tile.component";
import { BitwardenIcon } from "../shared/icon";
import { TypographyDirective } from "../typography/typography.directive";

export type BannerVariant = "primary" | "success" | "warning" | "danger";

const defaultIcon: Record<BannerVariant, BitwardenIcon> = {
  primary: "bwi-info-circle",
  success: "bwi-star",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
};

const bannerColors: Record<BannerVariant, string> = {
  primary: "tw-bg-bg-brand-softer tw-border-b-border-brand-soft",
  success: "tw-bg-bg-success-soft tw-border-b-border-success-soft",
  warning: "tw-bg-bg-warning-soft tw-border-b-border-warning-soft",
  danger: "tw-bg-bg-danger-soft tw-border-b-border-danger-soft",
};

/**
 * The banner component is used to communicate prominent messages or important system states to users.
 * It draws the user's attention to information that requires awareness or action without interrupting their primary task.
 *
 * - Always be dismissible and never use a timeout. If a user dismisses a banner, it should not reappear during that same active session.
 * - Use sparingly, as they can feel intrusive to the user if they appear unexpectedly. Their effectiveness may decrease if too many are used.
 * - Avoid stacking multiple banners.
 * - Avoid overloading banners with information. Keep text short and focused.
 */
@Component({
  selector: "bit-banner",
  templateUrl: "./banner.component.html",
  imports: [IconButtonModule, IconTileComponent, I18nPipe, TypographyDirective],
  host: {
    // Account for bit-layout's padding
    class:
      "tw-@container tw-flex tw-flex-col [bit-layout_&]:-tw-mx-8 [bit-layout_&]:-tw-my-6 [bit-layout_&]:tw-pb-6",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BannerComponent implements OnInit {
  /**
   * The variant of banner, which determines its color scheme.
   */
  readonly variant = input<BannerVariant>("primary");

  /**
   * The title to display above the body text. When provided, the actions slot becomes visible
   * and the layout shifts to its expanded form.
   */
  readonly title = input<string | null>();

  /**
   * The icon to display. If not provided, a default icon based on variant will be used.
   * Explicitly passing null will remove the icon.
   */
  readonly icon = input<BitwardenIcon | null>();

  /**
   * Whether to use ARIA alert role for screen readers.
   */
  readonly useAlertRole = input(true);

  private readonly dismiss$ = new Subject<void>();
  readonly dismiss = outputFromObservable(this.dismiss$);
  protected readonly isDismissible = signal(false);

  ngOnInit() {
    this.isDismissible.set(this.dismiss$.observed);
  }

  protected onDismiss(): void {
    this.dismiss$.next();
  }

  /**
   * Actions slot only renders when a title is present.
   */
  protected readonly showActions = computed(() => !!this.title());

  /**
   * The computed icon to display, falling back to the default icon for the variant.
   * Pass `null` to `[icon]` to suppress the icon entirely.
   */
  protected readonly displayIcon = computed(() => {
    if (this.icon() === null) {
      return null;
    }
    return this.icon() ?? defaultIcon[this.variant()];
  });

  protected readonly alignClass = computed(() =>
    this.showActions() ? "tw-items-start" : "tw-items-center @3xl:tw-justify-center",
  );

  protected readonly bannerClass = computed(
    () => `${this.alignClass()} ${bannerColors[this.variant()]}`,
  );
}
