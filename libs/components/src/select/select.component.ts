import { hasModifierKey } from "@angular/cdk/keycodes";
import {
  AfterViewInit,
  Component,
  ContentChildren,
  DestroyRef,
  HostBinding,
  Input,
  QueryList,
  Output,
  EventEmitter,
  computed,
  effect,
  inject,
  input,
  Signal,
  model,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ControlValueAccessor,
  NgControl,
  StatusChangeEvent,
  TouchedChangeEvent,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from "@angular/forms";
import { NgSelectComponent, NgSelectModule } from "@ng-select/ng-select";
import { filter } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitFormFieldControl } from "../form-field";

import { Option } from "./option";
import { OptionComponent } from "./option.component";

let nextId = 0;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-select",
  templateUrl: "select.component.html",
  providers: [{ provide: BitFormFieldControl, useExisting: SelectComponent }],
  imports: [NgSelectModule, ReactiveFormsModule, FormsModule],
  host: {
    "[id]": "id()",
    "[attr.aria-describedby]": "ariaDescribedBy()",
  },
})
export class SelectComponent<T>
  implements AfterViewInit, BitFormFieldControl, ControlValueAccessor
{
  private readonly i18nService = inject(I18nService);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  readonly select = viewChild.required(NgSelectComponent);

  /** Optional: Options can be provided using an array input or using `bit-option` */
  readonly items = model<Option<T>[] | undefined>();

  readonly placeholder = input(this.i18nService.t("selectPlaceholder"));
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() closed = new EventEmitter();

  protected readonly selectedValue = signal<T | undefined | null>(undefined);
  readonly selectedOption: Signal<Option<T> | null | undefined> = computed(() =>
    this.findSelectedOption(this.items(), this.selectedValue()),
  );
  protected searchInputId = `bit-select-search-input-${nextId++}`;

  private notifyOnChange?: (value?: T | null) => void;
  private notifyOnTouched?: () => void;
  private readonly controlEvent = signal<unknown>(null);
  private readonly destroyRef = inject(DestroyRef);
  readonly hasError: Signal<boolean> = computed(() => {
    this.controlEvent();
    return !!(this.ngControl?.status === "INVALID" && this.ngControl?.touched);
  });

  constructor() {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
    effect(() => {
      this.select()
        ?.searchInput()
        .nativeElement.setAttribute("aria-describedby", this.ariaDescribedBy() ?? "");
    });
  }

  ngAfterViewInit() {
    this.ngControl?.control?.events
      .pipe(
        filter((e) => e instanceof TouchedChangeEvent || e instanceof StatusChangeEvent),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.controlEvent.set(e));
  }

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get disabled() {
    return this._disabled ?? this.ngControl?.disabled ?? false;
  }
  set disabled(value: any) {
    this._disabled = value != null && value !== false;
  }
  private _disabled?: boolean;

  /**Implemented as part of NG_VALUE_ACCESSOR */
  writeValue(obj: T): void {
    this.selectedValue.set(obj);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  registerOnChange(fn: (value?: T | null) => void): void {
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
  readonly ariaDescribedBy = signal<string | undefined>(undefined);

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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get required() {
    return this._required ?? this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  }
  set required(value: any) {
    this._required = value != null && value !== false;
  }
  private _required?: boolean;

  /**Implemented as part of BitFormFieldControl */
  get error(): [string, any] {
    const errors = this.ngControl?.errors ?? {};
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  }

  private findSelectedOption(
    items: Option<T>[] | undefined,
    value: T | null | undefined,
  ): Option<T> | undefined {
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
    if (this.select().isOpen() && event.key === "Escape" && !hasModifierKey(event)) {
      event.stopPropagation();
    }

    return true;
  };
}
