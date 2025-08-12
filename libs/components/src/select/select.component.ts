// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { hasModifierKey } from "@angular/cdk/keycodes";
import {
  Component,
  ContentChildren,
  HostBinding,
  Input,
  Optional,
  QueryList,
  Self,
  ViewChild,
  Output,
  EventEmitter,
  input,
  Signal,
  computed,
  model,
  signal,
} from "@angular/core";
import {
  ControlValueAccessor,
  NgControl,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from "@angular/forms";
import { NgSelectComponent, NgSelectModule } from "@ng-select/ng-select";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitFormFieldControl } from "../form-field";

import { Option } from "./option";
import { OptionComponent } from "./option.component";

let nextId = 0;

@Component({
  selector: "bit-select",
  templateUrl: "select.component.html",
  providers: [{ provide: BitFormFieldControl, useExisting: SelectComponent }],
  imports: [NgSelectModule, ReactiveFormsModule, FormsModule],
  host: {
    "[id]": "id()",
  },
})
export class SelectComponent<T> implements BitFormFieldControl, ControlValueAccessor {
  @ViewChild(NgSelectComponent) select: NgSelectComponent;

  /** Optional: Options can be provided using an array input or using `bit-option` */
  readonly items = model<Option<T>[] | undefined>();

  readonly placeholder = input(this.i18nService.t("selectPlaceholder"));
  @Output() closed = new EventEmitter();

  protected selectedValue = signal<T>(undefined);
  selectedOption: Signal<Option<T>> = computed(() =>
    this.findSelectedOption(this.items(), this.selectedValue()),
  );
  protected searchInputId = `bit-select-search-input-${nextId++}`;

  private notifyOnChange?: (value: T) => void;
  private notifyOnTouched?: () => void;

  constructor(
    private i18nService: I18nService,
    @Optional() @Self() private ngControl?: NgControl,
  ) {
    if (ngControl != null) {
      ngControl.valueAccessor = this;
    }
  }

  @ContentChildren(OptionComponent)
  protected set options(value: QueryList<OptionComponent<T>>) {
    if (value == null || value.length == 0) {
      return;
    }
    this.items.set(
      value.toArray().map((option) => ({
        icon: option.icon(),
        value: option.value(),
        label: option.label(),
        disabled: option.disabled(),
      })),
    );
  }

  @HostBinding("class") protected classes = ["tw-block", "tw-w-full", "tw-h-full"];

  // Usings a separate getter for the HostBinding to get around an unexplained angular error
  @HostBinding("attr.disabled")
  get disabledAttr() {
    return this.disabled || null;
  }
  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  get disabled() {
    return this._disabled ?? this.ngControl?.disabled ?? false;
  }
  set disabled(value: any) {
    this._disabled = value != null && value !== false;
  }
  private _disabled: boolean;

  /**Implemented as part of NG_VALUE_ACCESSOR */
  writeValue(obj: T): void {
    this.selectedValue.set(obj);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  registerOnChange(fn: (value: T) => void): void {
    this.notifyOnChange = fn;
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  registerOnTouched(fn: any): void {
    this.notifyOnTouched = fn;
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  protected onChange(option: Option<T> | null) {
    this.selectedValue.set(option?.value);

    if (!this.notifyOnChange) {
      return;
    }

    this.notifyOnChange(option?.value);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  protected onBlur() {
    if (!this.notifyOnTouched) {
      return;
    }

    this.notifyOnTouched();
  }

  /**Implemented as part of BitFormFieldControl */
  @HostBinding("attr.aria-describedby")
  get ariaDescribedBy() {
    return this._ariaDescribedBy;
  }
  set ariaDescribedBy(value: string) {
    this._ariaDescribedBy = value;
    this.select?.searchInput.nativeElement.setAttribute("aria-describedby", value);
  }
  private _ariaDescribedBy: string;

  /**Implemented as part of BitFormFieldControl */
  get labelForId() {
    return this.searchInputId;
  }

  /**Implemented as part of BitFormFieldControl */
  readonly id = input(`bit-multi-select-${nextId++}`);

  /**Implemented as part of BitFormFieldControl */
  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @HostBinding("attr.required")
  @Input()
  get required() {
    return this._required ?? this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  }
  set required(value: any) {
    this._required = value != null && value !== false;
  }
  private _required: boolean;

  /**Implemented as part of BitFormFieldControl */
  get hasError() {
    return this.ngControl?.status === "INVALID" && this.ngControl?.touched;
  }

  /**Implemented as part of BitFormFieldControl */
  get error(): [string, any] {
    const key = Object.keys(this.ngControl?.errors)[0];
    return [key, this.ngControl?.errors[key]];
  }

  private findSelectedOption(items: Option<T>[] | undefined, value: T): Option<T> | undefined {
    return items?.find((item) => item.value === value);
  }

  /**Emits the closed event. */
  protected onClose() {
    this.closed.emit();
  }

  /**
   * Prevent Escape key press from propagating to parent components
   * (for example, parent dialog should not close when Escape is pressed in the select)
   *
   * @returns true to keep default key behavior; false to prevent default key behavior
   *
   * Needs to be arrow function to retain `this` scope.
   */
  protected onKeyDown = (event: KeyboardEvent) => {
    if (this.select.isOpen && event.key === "Escape" && !hasModifierKey(event)) {
      event.stopPropagation();
    }

    return true;
  };
}
