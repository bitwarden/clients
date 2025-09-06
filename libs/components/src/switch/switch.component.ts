import { NgClass } from "@angular/common";
import {
  Component,
  computed,
  contentChild,
  ElementRef,
  inject,
  input,
  model,
  AfterViewInit,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { AriaDisableDirective } from "../a11y";
import { FormControlModule } from "../form-control/form-control.module";
import { BitHintComponent } from "../form-control/hint.component";
import { BitLabel } from "../form-control/label.component";

let nextId = 0;

/**
 * Switch component for toggling between two states. Switch actions are meant to take place immediately and are not to be used in a form where saving/submiting actions are required.
 */
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
    "[attr.title]": "this.disabled() ? this.disabledReasonText() : null",
  },
  hostDirectives: [AriaDisableDirective],
})
export class SwitchComponent implements ControlValueAccessor, AfterViewInit {
  private el = inject(ElementRef<HTMLButtonElement>);
  private readonly label = contentChild.required(BitLabel);

  /**
   * Model signal for selected state binding when used outside of a form
   */
  protected selected = model(false);

  /**
   * Model signal for disabled binding when used outside of a form
   */
  protected disabled = model(false);
  protected disabledReasonText = input<string | null>(null);

  private hintComponent = contentChild<BitHintComponent>(BitHintComponent);

  private disabledReasonTextId = `bit-switch-disabled-text-${nextId++}`;

  private describedByIds = computed(() => {
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

  // ControlValueAccessor functions
  private notifyOnChange: (value: boolean) => void = () => {};
  private notifyOnTouch: () => void = () => {};

  writeValue(value: boolean): void {
    this.selected.set(value);
  }

  onChange(value: boolean): void {
    this.selected.set(value);

    if (this.notifyOnChange != undefined) {
      this.notifyOnChange(value);
    }
  }

  onTouch() {
    if (this.notifyOnTouch != undefined) {
      this.notifyOnTouch();
    }
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.notifyOnChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.notifyOnTouch = fn;
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled.set(isDisabled);
  }
  // end ControlValueAccessor functions

  readonly id = input(`bit-switch-${nextId++}`);

  protected onInputChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.onChange(checked);
    this.onTouch();
  }

  get inputId() {
    return `${this.id()}-input`;
  }

  ngAfterViewInit() {
    if (!this.label()) {
      // This is only here so Angular throws a compilation error if no label is provided.
      // the `this.label()` value must try to be accessed for the required content child check to throw
      // eslint-disable-next-line no-console
      console.error("No label component provided. <bit-switch> must be used with a <bit-label>.");
    }
  }
}
