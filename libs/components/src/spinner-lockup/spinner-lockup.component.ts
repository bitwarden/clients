import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import {
  SpinnerSize,
  spinnerSizeStyles,
  SpinnerVariant,
  SpinnerComponent,
} from "../spinner/spinner.component";

// import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

type SpinnerLockupLayout = "horizontal" | "vertical";

@Component({
  selector: "bit-spinner-lockup",
  templateUrl: "spinner-lockup.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
})
export class SpinnerLockupComponent {
  // Inputs
  readonly size = input<SpinnerSize>("base");
  readonly variant = input<SpinnerVariant>("primary");
  readonly layout = input<SpinnerLockupLayout>("horizontal");
  readonly title = input<string>();
  readonly body = input<string>();

  // private i18nService = inject(I18nService);

  readonly sizeClasses = computed(() => spinnerSizeStyles[this.size()].join(" "));

  readonly layoutClasses = computed(() =>
    this.layout() === "horizontal"
      ? "tw-flex tw-flex-row tw-items-center tw-gap-3"
      : "tw-flex tw-flex-col tw-items-center tw-gap-2",
  );

  protected readonly textContainerClasses = computed(() =>
    this.layout() === "vertical" ? "tw-flex tw-flex-col tw-items-center" : "tw-flex tw-flex-col",
  );
}
