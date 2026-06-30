import { hasModifierKey } from "@angular/cdk/keycodes";
import {
  afterRenderEffect,
  Component,
  contentChildren,
  HostBinding,
  Input,
  output,
  computed,
  effect,
  inject,
  input,
  Signal,
  model,
  signal,
  viewChild,
} from "@angular/core";
import { ControlValueAccessor, NgControl, ReactiveFormsModule, FormsModule } from "@angular/forms";
import { NgSelectComponent, NgSelectModule } from "@ng-select/ng-select";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitFormFieldControlDirective } from "../form-field";
import { IconComponent } from "../icon";
import { TypographyDirective } from "../typography/typography.directive";

import { Option } from "./option";
import { OptionComponent } from "./option.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-select",
  templateUrl: "select.component.html",
  hostDirectives: [
    {
      directive: BitFormFieldControlDirective,
      inputs: ["required", "id"],
    },
  ],
  imports: [NgSelectModule, ReactiveFormsModule, FormsModule, TypographyDirective, IconComponent],
  host: {
    class: "tw-block tw-w-full tw-h-full",
    "[id]": "formFieldControl.id()",
    "[attr.required]": "formFieldControl.required() || null",
  },
})
export class SelectComponent<T> implements ControlValueAccessor {
  private readonly i18nService = inject(I18nService);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  readonly formFieldControl = inject(BitFormFieldControlDirective);
  readonly labelForId = this.formFieldControl.labelForId;

  readonly select = viewChild.required(NgSelectComponent);

  /** Optional: Options can be provided using an array input or using `bit-option` */
  readonly items = model<Option<T>[] | undefined>();

  readonly placeholder = input(this.i18nService.t("selectPlaceholder"));
  readonly closed = output();

  protected readonly selectedValue = signal<T | undefined | null>(undefined);
  readonly selectedOption: Signal<Option<T> | null | undefined> = computed(() =>
    this.findSelectedOption(this.items(), this.selectedValue()),
  );
  protected readonly searchInputId = computed(() => `${this.formFieldControl.id()}-search`);

  private notifyOnChange?: (value?: T | null) => void;
  private notifyOnTouched?: () => void;

  constructor() {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
    effect(() => this.formFieldControl.labelForId.set(this.searchInputId()));
    effect(() => {
      this.select()
        ?.searchInput()
        .nativeElement.setAttribute(
          "aria-describedby",
          this.formFieldControl.ariaDescribedBy() ?? "",
        );
    });
    afterRenderEffect({
      read: () => {
        const opts = this.options();
        if (opts.length === 0) {
          return;
        }
        this.items.set(
          opts.map((option) => ({
            icon: option.icon(),
            value: option.value(),
            label: option.label(),
            description: option.description(),
            disabled: option.disabled(),
          })),
        );
      },
    });
  }

  private readonly options = contentChildren(OptionComponent);

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
