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
      inputs: ["label", "inline", "disableMargin"],
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

    effect(() => {
      const hostEl = this.base.formControlEl().nativeElement;
      const inputId = this.base.inputId();
      const hasError = this.base.formControl().hasError;

      const describedBy = hasError ? this.errorId : (this.hint()?.id ?? null);

      if (this.switch()) {
        // For SwitchComponent, use signals to set ARIA directly on the inner input,
        // avoiding a querySelector race with Angular's property binding rendering cycle
        this.switch()?.ariaLabelledBy.set(this.labelId);
        this.switch()?.ariaDescribedBy.set(describedBy ?? undefined);
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

    // When inside a group, drive checked/disabled state into the inner control
    effect(() => {
      if (!this.groupItem.group || this.groupItem.value() === undefined) {
        return;
      }
      const isSelected = this.groupItem.isSelected();
      const isDisabled = this.groupItem.isDisabled();
      const el = this.base.formControlEl().nativeElement;
      const inputEl: HTMLInputElement | null =
        el.tagName === "INPUT" ? (el as HTMLInputElement) : el.querySelector("input");
      if (inputEl) {
        inputEl.checked = isSelected;
        inputEl.disabled = isDisabled;
      }
      this.switch()?.writeValue(isSelected);
    });
  }
}
