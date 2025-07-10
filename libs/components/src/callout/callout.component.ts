// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnInit } from "@angular/core";

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
export class CalloutComponent implements OnInit {
  @Input() type: CalloutTypes = "info";
  @Input() icon: string;
  @Input() title: string;
  @Input() useAlertRole = false;
  protected titleId = `bit-callout-title-${nextId++}`;

  constructor(private i18nService: I18nService) {}

  ngOnInit() {
    this.icon ??= defaultIcon[this.type];
    if (this.title == null && defaultI18n[this.type] != null) {
      this.title = this.i18nService.t(defaultI18n[this.type]);
    }
  }

  get calloutClass() {
    switch (this.type) {
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
