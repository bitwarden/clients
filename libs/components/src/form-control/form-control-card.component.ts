import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  effect,
  inject,
  input,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconTileComponent } from "../icon-tile";
import { BitwardenIcon } from "../shared/icon";
import { SwitchComponent } from "../switch";
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
  host: {
    class: "[&_bit-hint]:tw-leading-4 [&_bit-hint]:tw-mt-0",
  },
  imports: [TypographyDirective, I18nPipe, IconTileComponent],
})
export class FormControlCardComponent {
  protected readonly icon = input<BitwardenIcon>();
  protected readonly base = inject(FormControlBaseDirective);

  readonly labelId = `${this.base.id}-label`;
  readonly errorId = `${this.base.id}-error`;

  protected readonly hint = contentChild(BitHintDirective);
  protected readonly switch = contentChild(SwitchComponent);

  constructor() {
    effect(() => {
      this.switch()?.size.set("large");
    });

    effect(() => {
      const hostEl = this.base.formControlEl().nativeElement;
      const inputId = this.base.inputId();
      const hasError = this.base.formControl().hasError;

      const describedBy = hasError ? this.errorId : (this.hint()?.id ?? null);

      if (this.switch()) {
        // For SwitchComponent, use signals to set ARIA directly on the inner input,
        // avoiding a querySelector race with Angular's property binding rendering cycle
        this.switch().ariaLabelledBy.set(this.labelId);
        this.switch().ariaDescribedBy.set(describedBy ?? undefined);
        hostEl.removeAttribute("aria-labelledby");
        hostEl.removeAttribute("aria-describedby");
      } else {
        // For other controls (e.g. checkbox), the host element is the input itself
        const inputEl = hostEl.id !== inputId ? hostEl.querySelector(`[id="${inputId}"]`) : null;
        const el = inputEl || hostEl;
        if (inputEl) {
          hostEl.removeAttribute("aria-labelledby");
          hostEl.removeAttribute("aria-describedby");
        }
        el.setAttribute("aria-labelledby", this.labelId);
        if (describedBy) {
          el.setAttribute("aria-describedby", describedBy);
        } else {
          el.removeAttribute("aria-describedby");
        }
      }
    });
  }
}
