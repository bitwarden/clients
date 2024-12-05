// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnInit } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SharedModule } from "../shared";
import { TypographyModule } from "../typography";

export type CalloutTypes = "success" | "info" | "warning" | "danger";

const defaultIcon: Record<CalloutTypes, string> = {
  success: "bwi-check",
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

@Component({
  selector: "bit-callout",
  templateUrl: "callout.component.html",
  standalone: true,
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
        return "tw-border-danger-600";
      case "info":
        return "tw-border-info-600";
      case "success":
        return "tw-border-success-600";
      case "warning":
        return "tw-border-warning-600";
    }
  }

  get headerClass() {
    switch (this.type) {
      case "danger":
        return "!tw-text-danger";
      case "info":
        return "!tw-text-info";
      case "success":
        return "!tw-text-success";
      case "warning":
        return "!tw-text-warning";
    }
  }
}
