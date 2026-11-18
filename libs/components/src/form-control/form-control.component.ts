import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconComponent } from "../icon";
import { TypographyDirective } from "../typography/typography.directive";

import { FormControlBaseDirective } from "./form-control-base.directive";

@Component({
  selector: "bit-form-control",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "form-control.component.html",
  hostDirectives: [
    {
      directive: FormControlBaseDirective,
      inputs: ["label", "inline", "disableMargin"],
    },
  ],
  imports: [TypographyDirective, I18nPipe, IconComponent],
})
export class FormControlComponent {
  protected readonly base = inject(FormControlBaseDirective);
}
