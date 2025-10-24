import { hasModifierKey } from "@angular/cdk/keycodes";
import {
  Component,
  Input,
  OnInit,
  Output,
  EventEmitter,
  HostBinding,
  Optional,
  Self,
  input,
  model,
  booleanAttribute,
  viewChild,
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
import { I18nPipe } from "@bitwarden/ui-common";

import { BadgeModule } from "../badge";
import { BitFormFieldControl } from "../form-field/form-field-control";
import { SpinnerComponent } from "../spinner";

import { SelectItemView } from "./models/select-item-view";

// Increments for each instance of this component
let nextId = 0;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-multi-select",
  templateUrl: "./multi-select.component.html",
  providers: [{ provide: BitFormFieldControl, useExisting: MultiSelectComponent }],
  imports: [
    NgSelectModule,
    ReactiveFormsModule,
    FormsModule,
    BadgeModule,
    I18nPipe,
    SpinnerComponent,
  ],
  host: {
    "[id]": "this.id()",
  },
})
/**
 * This component has been implemented to only support Multi-select list events
 */
export class MultiSelectComponent implements OnInit, BitFormFieldControl, ControlValueAccessor {
  readonly select = viewChild.required(NgSelectComponent);

  // Parent component should only pass selectable items (complete list - selected items = baseItems)
  readonly baseItems = model.required<SelectItemView[]>();
  // Defaults to native ng-select behavior - set to "true" to clear selected items on dropdown close
  readonly removeSelectedItems = input(false);
  readonly placeholder = model<string>();
  readonly loading = input(false);
  // TODO: Skipped for signal migration because:
  //  Your application code writes to the input. This prevents migration.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: booleanAttribute }) disabled?: boolean;

  // Internal tracking of selected items
  protected selectedItems: SelectItemView[] | null = null;

  // Default values for our implementation
  loadingText?: string;

  protected searchInputId = `search-input-${nextId++}`;

  /**Implemented as part of NG_VALUE_ACCESSOR */
  private notifyOnChange?: (value: SelectItemView[]) => void;
  /**Implemented as part of NG_VALUE_ACCESSOR */
  private notifyOnTouched?: () => void;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onItemsConfirmed = new EventEmitter<any[]>();

  constructor(
    private i18nService: I18nService,
    @Optional() @Self() private ngControl?: NgControl,
  ) {
    if (ngControl != null) {
      ngControl.valueAccessor = this;
    }
  }

  ngOnInit(): void {
    // Default Text Values
    this.placeholder.update(
      (placeholder) => placeholder ?? this.i18nService.t("multiSelectPlaceholder"),
    );
    this.loadingText = this.i18nService.t("multiSelectLoading");
  }

  /** Function for customizing keyboard navigation */
  /** Needs to be arrow function to retain `this` scope. */
  keyDown = (event: KeyboardEvent) => {
    const select = this.select();
    if (!select.isOpen && event.key === "Enter" && !hasModifierKey(event)) {
      return false;
    }

    if (select.isOpen && event.key === "Escape" && !hasModifierKey(event)) {
      this.selectedItems = [];
      select.close();
      event.stopPropagation();
      return false;
    }

    return true;
  };

  /** Helper method for showing selected state in custom template */
  isSelected(item: any): boolean {
    return this.selectedItems?.find((selected) => selected.id === item.id) != undefined;
  }

  /**
   * The `close` callback will act as the only trigger for signifying the user's intent of completing the selection
   * of items. Selected items will be emitted to the parent component in order to allow for separate data handling.
   */
  onDropdownClosed(): void {
    // Early exit
    if (this.selectedItems == null || this.selectedItems.length == 0) {
      return;
    }

    // Emit results to parent component
    this.onItemsConfirmed.emit(this.selectedItems);

    // Remove selected items from base list based on input property
    if (this.removeSelectedItems()) {
      let updatedBaseItems = this.baseItems();
      this.selectedItems.forEach((selectedItem) => {
        updatedBaseItems = updatedBaseItems.filter((item) => selectedItem.id !== item.id);
      });

      // Reset Lists
      this.selectedItems = null;
      this.baseItems.set(updatedBaseItems);
    }
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  writeValue(obj: SelectItemView[]): void {
    this.selectedItems = obj;
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  registerOnChange(fn: (value: SelectItemView[]) => void): void {
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
  protected onChange(items: SelectItemView[]) {
    if (!this.notifyOnChange) {
      return;
    }

    this.notifyOnChange(items);
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
  set ariaDescribedBy(value: string | undefined) {
    this._ariaDescribedBy = value;
    this.select()?.searchInput.nativeElement.setAttribute("aria-describedby", value ?? "");
  }
  private _ariaDescribedBy?: string;

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
  get hasError() {
    return !!(this.ngControl?.status === "INVALID" && this.ngControl?.touched);
  }

  /**Implemented as part of BitFormFieldControl */
  get error(): [string, any] {
    const errors = this.ngControl?.errors ?? {};
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  }
}
