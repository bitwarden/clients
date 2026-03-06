import { ChangeDetectionStrategy, Component, contentChild, effect, inject } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { TypographyDirective } from "../typography/typography.directive";

import { FormControlBaseDirective } from "./form-control-base.directive";
import { BitHintDirective } from "./hint.directive";
@Component({
  selector: "bit-form-control-card",
  templateUrl: "form-control-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: FormControlBaseDirective,
      inputs: ["label", "inline", "disableMargin"],
    },
  ],
  imports: [TypographyDirective, I18nPipe],
})
export class FormControlCardComponent {
  protected base = inject(FormControlBaseDirective);

  readonly labelId = `${this.base.id}-label`;
  readonly errorId = `${this.base.id}-error`;

  protected readonly hint = contentChild(BitHintDirective);

  constructor() {
    effect(() => {
      const hostEl = this.base.formControlEl().nativeElement;
      const inputId = this.base.inputId();

      // For components like SwitchComponent where the actual input is nested
      // inside the template, target that element directly
      const el = (hostEl.id !== inputId && hostEl.querySelector(`[id="${inputId}"]`)) || hostEl;

      el.setAttribute("aria-labelledby", this.labelId);

      if (this.base.hasError) {
        el.setAttribute("aria-describedby", this.errorId);
      } else if (this.hint()) {
        el.setAttribute("aria-describedby", this.hint()!.id);
      } else {
        el.removeAttribute("aria-describedby");
      }
    });
  }
}
