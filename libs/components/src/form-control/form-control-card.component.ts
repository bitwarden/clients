import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  effect,
  inject,
  input,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconComponent } from "../icon";
import { IconTileComponent } from "../icon-tile";
import { BitwardenIcon } from "../shared/icon";
import { SwitchComponent } from "../switch";
import { TypographyDirective } from "../typography/typography.directive";

import { FormControlBaseDirective } from "./form-control-base.directive";
import { FormControlGroupComponent } from "./form-control-group.component";
import { BitHintDirective } from "./hint.directive";

@Component({
  selector: "bit-form-control-card",
  templateUrl: "form-control-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: FormControlBaseDirective,
      inputs: ["label", "inline"],
    },
  ],
  host: {
    class: "[&_bit-hint]:tw-leading-4 [&_bit-hint]:tw-mt-0",
  },
  imports: [TypographyDirective, I18nPipe, IconTileComponent, IconComponent],
})
export class FormControlCardComponent {
  protected readonly icon = input<BitwardenIcon>();
  protected readonly base = inject(FormControlBaseDirective);
  private readonly group = inject(FormControlGroupComponent, { optional: true });

  readonly labelId = `${this.base.id}-label`;
  readonly errorId = `${this.base.id}-error`;

  protected readonly hint = contentChild(BitHintDirective);
  protected readonly switch = contentChild(SwitchComponent);

  constructor() {
    effect(() => {
      this.switch()?.size.set("large");
    });

    this.base.disableMarginSignal.set(true);

    // Wire aria-labelledby and aria-describedby onto the inner input element.
    // The card uses an absolute-positioned overlay label, so the browser's native
    // label association doesn't reach the visible text — we wire it manually.
    effect(() => {
      const controlWrapperEl = this.base.formControlEl().nativeElement;
      const hintId = this.group ? (this.group.hint()?.id ?? null) : (this.hint()?.id ?? null);
      const errorId = this.group ? (this.group.errorId ?? null) : this.errorId;
      const ariaDescribedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
      const switchElement = this.switch();

      if (switchElement) {
        // For SwitchComponent, use signals to set ARIA directly on the inner input,
        // avoiding a querySelector race with Angular's property binding rendering cycle
        const labelledByIds = new Set(
          (switchElement.ariaLabelledBy() ?? "").split(" ").filter(Boolean),
        );
        labelledByIds.add(this.labelId);
        switchElement.ariaLabelledBy.set([...labelledByIds].join(" "));
        switchElement.ariaDescribedBy.set(ariaDescribedBy);
      } else {
        const ariaTargetEl = this.base.formControl().inputEl?.nativeElement ?? controlWrapperEl;

        const labelledByIds = new Set(
          (ariaTargetEl.getAttribute("aria-labelledby") ?? "").split(" ").filter(Boolean),
        );
        labelledByIds.add(this.labelId);

        // Clear ARIA from wrapper — inner element owns these
        controlWrapperEl.removeAttribute("aria-labelledby");
        controlWrapperEl.removeAttribute("aria-describedby");

        ariaTargetEl.setAttribute("aria-labelledby", [...labelledByIds].join(" "));

        if (ariaDescribedBy) {
          ariaTargetEl.setAttribute("aria-describedby", ariaDescribedBy);
        } else {
          ariaTargetEl.removeAttribute("aria-describedby");
        }
      }
    });
  }
}
