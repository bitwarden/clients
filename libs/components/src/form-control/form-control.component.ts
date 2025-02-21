// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass } from "@angular/common";
import { Component, ContentChild, HostBinding, Input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { TypographyDirective } from "../typography/typography.directive";

import { BitFormControlAbstraction } from "./form-control.abstraction";

@Component({
  selector: "bit-form-control",
  templateUrl: "form-control.component.html",
  standalone: true,
  imports: [NgClass, TypographyDirective, I18nPipe],
})
export class FormControlComponent {
  @Input() label: string;

  private _inline = false;
  @Input() get inline() {
    return this._inline;
  }
  set inline(value: boolean | "") {
    this._inline = coerceBooleanProperty(value);
  }

  private _disableMargin = false;
  @Input() set disableMargin(value: boolean | "") {
    this._disableMargin = coerceBooleanProperty(value);
  }
  get disableMargin() {
    return this._disableMargin;
  }

  @ContentChild(BitFormControlAbstraction) protected formControl: BitFormControlAbstraction;

  @HostBinding("class") get classes() {
    return []
      .concat(this.inline ? ["tw-inline-block", "tw-mr-4"] : ["tw-block"])
      .concat(this.disableMargin ? [] : ["tw-mb-4"]);
  }

  constructor(private i18nService: I18nService) {}

  get required() {
    return this.formControl.required;
  }

  get hasError() {
    return this.formControl.hasError;
  }

  get error() {
    return this.formControl.error;
  }

  get displayError() {
    switch (this.error[0]) {
      case "required":
        return this.i18nService.t("inputRequired");
      default:
        // Attempt to show a custom error message.
        if (this.error[1]?.message) {
          return this.error[1]?.message;
        }

        return this.error;
    }
  }
}
