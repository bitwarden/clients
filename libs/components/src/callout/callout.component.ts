// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, computed, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SharedModule } from "../shared";
import { TypographyModule } from "../typography";

export type CalloutTypes = "success" | "info" | "warning" | "danger";

const defaultIcon: Record<CalloutTypes, string> = {
  success: "bwi-check-circle",
  info: "bwi-info-circle",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
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
@Component({
  selector: "bit-callout",
  templateUrl: "callout.component.html",
  imports: [SharedModule, TypographyModule],
})
export class CalloutComponent {
  readonly type = input<CalloutTypes>("info");
  readonly icon = input<string>();
  readonly title = input<string>();
  readonly useAlertRole = input(false);
  readonly iconComputed = computed(() => this.icon() ?? defaultIcon[this.type()]);
  readonly titleComputed = computed(() => {
    const title = this.title();
    const type = this.type();
    if (title == null && defaultI18n[type] != null) {
      return this.i18nService.t(defaultI18n[type]);
    }

    return title;
  });

  protected titleId = `bit-callout-title-${nextId++}`;

  constructor(private i18nService: I18nService) {}

  get calloutClass() {
    switch (this.type()) {
      case "danger":
        return "tw-bg-danger-100";
      case "info":
        return "tw-bg-info-100";
      case "success":
        return "tw-bg-success-100";
      case "warning":
        return "tw-bg-warning-100";
    }
  }
}
