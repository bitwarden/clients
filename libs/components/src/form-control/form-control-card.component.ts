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
import { FormControlGroupItemDirective } from "./form-control-group-item.directive";
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
    {
      directive: FormControlGroupItemDirective,
      inputs: ["value"],
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
  protected readonly groupItem = inject(FormControlGroupItemDirective);

  readonly labelId = `${this.base.id}-label`;
  readonly errorId = `${this.base.id}-error`;

  protected onInnerChange() {
    if (this.inGroup) {
      this.groupItem.notifyChange();
    }
  }

  protected get inGroup() {
    return this.groupItem.group != null && this.groupItem.value() !== undefined;
  }

  get required() {
    return this.inGroup ? false : this.base.required;
  }

  get hasError() {
    return this.inGroup ? false : this.base.hasError;
  }

  get displayError() {
    return this.inGroup ? "" : this.base.displayError;
  }

  protected readonly hint = contentChild(BitHintDirective);
  protected readonly switch = contentChild(SwitchComponent);

  constructor() {
    effect(() => {
      this.switch()?.size.set("large");
    });

    this.base.disableMarginSignal.set(true);

    effect(() => {
      const hostEl = this.base.formControlEl().nativeElement;
      const hintId = this.inGroup
        ? (this.groupItem.group?.hint()?.id ?? null)
        : (this.hint()?.id ?? null);
      const errorId = this.inGroup ? (this.groupItem.group?.errorId ?? null) : this.errorId;
      const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
      const switchElement = this.switch();

      // Always clear ARIA from host wrapper — inner element owns these
      hostEl.removeAttribute("aria-labelledby");
      hostEl.removeAttribute("aria-describedby");

      if (switchElement) {
        // For SwitchComponent, use signals to set ARIA directly on the inner input,
        // avoiding a querySelector race with Angular's property binding rendering cycle
        const labelledByIds = new Set(
          (switchElement.ariaLabelledBy() ?? "").split(" ").filter(Boolean),
        );
        labelledByIds.add(this.labelId);
        switchElement.ariaLabelledBy.set([...labelledByIds].join(" "));
        switchElement.ariaDescribedBy.set(describedBy);
      } else {
        const el = this.base.formControl().inputEl?.nativeElement ?? hostEl;

        const labelledByIds = new Set(
          (el.getAttribute("aria-labelledby") ?? "").split(" ").filter(Boolean),
        );
        labelledByIds.add(this.labelId);
        el.setAttribute("aria-labelledby", [...labelledByIds].join(" "));

        if (describedBy) {
          el.setAttribute("aria-describedby", describedBy);
        } else {
          el.removeAttribute("aria-describedby");
        }
      }
    });

    // When inside a group, drive checked/disabled state into the inner control
    effect(() => {
      if (!this.groupItem.group || this.groupItem.value() === undefined) {
        return;
      }
      const isSelected = this.groupItem.isSelected();
      const isDisabled = this.groupItem.isDisabled();
      const inputEl = this.base.formControl().inputEl?.nativeElement ?? null;

      if (inputEl) {
        inputEl.checked = isSelected;
        inputEl.disabled = isDisabled;
      }

      this.switch()?.writeValue(isSelected);
    });
  }
}
