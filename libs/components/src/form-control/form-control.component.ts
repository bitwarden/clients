import { NgClass } from "@angular/common";
import { Component, inject } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { TypographyDirective } from "../typography/typography.directive";

import { FormControlBaseDirective } from "./form-control-base.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-form-control",
  templateUrl: "form-control.component.html",
  hostDirectives: [
    {
      directive: FormControlBaseDirective,
      inputs: ["label", "inline", "disableMargin"],
    },
  ],
  imports: [NgClass, TypographyDirective, I18nPipe],
})
export class FormControlComponent {
  protected base = inject(FormControlBaseDirective);
}
