import { Component, computed, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SharedModule } from "../shared";
import { TypographyModule } from "../typography";

export type CalloutTypes = "success" | "info" | "warning" | "danger" | "default";

const defaultIcon: Record<CalloutTypes, string> = {
  success: "bwi-check-circle",
  info: "bwi-info-circle",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
  default: "bwi-star",
};

const defaultI18n: Partial<Record<CalloutTypes, string>> = {
  warning: "warning",
  danger: "error",
};

// Increments for each instance of this component
let nextId = 0;

/**
 * Callouts are used to communicate important information to the user. Callouts should be used
 * sparingly, as they command a large amount of visual attention. Avoid using more than 1 callout in
 * the same location.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-callout",
  templateUrl: "callout.component.html",
  imports: [SharedModule, TypographyModule],
})
export class CalloutComponent {
  readonly type = input<CalloutTypes>("info");
  readonly icon = input<string>();
  readonly title = input<string | null>();
  readonly useAlertRole = input(false);
  readonly iconComputed = computed(() =>
    this.icon() === undefined ? defaultIcon[this.type()] : this.icon(),
  );
  readonly titleComputed = computed(() => {
    const title = this.title();
    if (title === null) {
      return undefined;
    }

    const type = this.type();
    if (title == null && defaultI18n[type] != null) {
      return this.i18nService.t(defaultI18n[type]);
    }

    return title;
  });

  protected readonly titleId = `bit-callout-title-${nextId++}`;

  constructor(private i18nService: I18nService) {}

  protected readonly calloutClass = computed(() => {
    switch (this.type()) {
      case "danger":
        return "tw-bg-danger-100 tw-border-danger-700 tw-text-danger-700";
      case "info":
        return "tw-bg-info-100 tw-bg-info-100 tw-border-info-700 tw-text-info-700";
      case "success":
        return "tw-bg-success-100 tw-bg-success-100 tw-border-success-700 tw-text-success-700";
      case "warning":
        return "tw-bg-warning-100 tw-bg-warning-100 tw-border-warning-700 tw-text-warning-700";
      case "default":
        return "tw-bg-background-alt tw-border-secondary-700 tw-text-secondary-700";
    }
  });
}
