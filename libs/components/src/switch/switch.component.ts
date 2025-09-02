import { NgClass } from "@angular/common";
import { Component, computed, contentChild, ElementRef, inject, input, model } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { AriaDisableDirective } from "../a11y";
import { FormControlModule } from "../form-control/form-control.module";
import { BitHintComponent } from "../form-control/hint.component";

let nextId = 0;

@Component({
  selector: "bit-switch",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: SwitchComponent,
      multi: true,
    },
  ],
  templateUrl: "switch.component.html",
  imports: [FormControlModule, NgClass],
  host: {
    "[id]": "this.id()",
    "[attr.aria-disabled]": "this.disabled()",
  },
  hostDirectives: [AriaDisableDirective],
})
export class SwitchComponent implements ControlValueAccessor {
  private notifyOnChange?: (v: boolean) => void;
  private notifyOnTouch?: () => void;
  private el = inject(ElementRef<HTMLButtonElement>);

  protected selected = model(false);
  protected disabled = model(false);
  protected disabledReasonText = input<string | null>(null);

  readonly hintComponent = contentChild<BitHintComponent>(BitHintComponent);

  private disabledReasonTextId = `bit-switch-disabled-text-${nextId++}`;

  readonly describedByIds = computed(() => {
    const ids: string[] = [];

    if (this.disabledReasonText() && this.disabled()) {
      ids.push(this.disabledReasonTextId);
    } else {
      const hintId = this.hintComponent()?.id;

      if (hintId) {
        ids.push(hintId);
      }
    }

    return ids.join(" ");
  });

  writeValue(value: boolean): void {
    this.selected.set(value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.notifyOnChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.notifyOnTouch = fn;
  }

  readonly id = input(`bit-switch-${nextId++}`);

  protected onInputChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.writeValue(checked);
    this.notifyOnChange(checked);
    this.notifyOnTouch();
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled.set(isDisabled);
  }

  get inputId() {
    return `${this.id()}-input`;
  }
}
