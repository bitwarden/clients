import { hasModifierKey } from "@angular/cdk/keycodes";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  Signal,
  computed,
  effect,
  inject,
  input,
  model,
  booleanAttribute,
  output,
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
import { I18nPipe } from "@bitwarden/ui-common";

import { ChipComponent } from "../chips";
import { BitFormFieldControl } from "../form-field/form-field-control";
import { IconComponent } from "../icon";
import { SpinnerComponent } from "../spinner";

import { SelectItemView } from "./models/select-item-view";

// Increments for each instance of this component
let nextId = 0;

@Component({
  selector: "bit-multi-select",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./multi-select.component.html",
  providers: [{ provide: BitFormFieldControl, useExisting: MultiSelectComponent }],
  imports: [
    IconComponent,
    NgSelectModule,
    ReactiveFormsModule,
    FormsModule,
    ChipComponent,
    I18nPipe,
    SpinnerComponent,
  ],
  host: {
    "[id]": "this.id()",
    "[attr.aria-describedby]": "ariaDescribedBy()",
    "[attr.required]": "required() || null",
  },
})
/**
 * This component has been implemented to only support Multi-select list events
 */
export class MultiSelectComponent
  implements AfterViewInit, OnInit, BitFormFieldControl, ControlValueAccessor
{
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
  protected readonly selectedItems = signal<SelectItemView[] | null>(null);

  // Default values for our implementation
  protected readonly loadingText = signal<string | undefined>(undefined);

  protected readonly searchInputId = `search-input-${nextId++}`;

  /**Implemented as part of NG_VALUE_ACCESSOR */
  private readonly notifyOnChange = signal<((value: SelectItemView[]) => void) | undefined>(
    undefined,
  );
  /**Implemented as part of NG_VALUE_ACCESSOR */
  private readonly notifyOnTouched = signal<(() => void) | undefined>(undefined);

  readonly onItemsConfirmed = output<any[]>();

  private readonly i18nService = inject(I18nService);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
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

  ngOnInit(): void {
    // Default Text Values
    this.placeholder.update(
      (placeholder) => placeholder ?? this.i18nService.t("multiSelectPlaceholder"),
    );
    this.loadingText.set(this.i18nService.t("multiSelectLoading"));
  }

  /** Function for customizing keyboard navigation */
  /** Needs to be arrow function to retain `this` scope. */
  readonly keyDown = (event: KeyboardEvent) => {
    const select = this.select();
    if (!select.isOpen() && event.key === "Enter" && !hasModifierKey(event)) {
      return false;
    }

    if (select.isOpen() && event.key === "Escape" && !hasModifierKey(event)) {
      this.selectedItems.set([]);
      select.close();
      event.stopPropagation();
      return false;
    }

    return true;
  };

  /** Helper method for showing selected state in custom template */
  isSelected(item: any): boolean {
    return (
      this.selectedItems()?.find((selected: SelectItemView) => selected.id === item.id) != undefined
    );
  }

  /**
   * The `close` callback will act as the only trigger for signifying the user's intent of completing the selection
   * of items. Selected items will be emitted to the parent component in order to allow for separate data handling.
   */
  onDropdownClosed(): void {
    const items = this.selectedItems();
    // Early exit
    if (items == null || items.length == 0) {
      return;
    }

    // Emit results to parent component
    this.onItemsConfirmed.emit(items);

    // Remove selected items from base list based on input property
    if (this.removeSelectedItems()) {
      let updatedBaseItems = this.baseItems();
      items.forEach((selectedItem) => {
        updatedBaseItems = updatedBaseItems.filter((item) => selectedItem.id !== item.id);
      });

      // Reset Lists
      this.selectedItems.set(null);
      this.baseItems.set(updatedBaseItems);
    }
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  writeValue(obj: SelectItemView[]): void {
    this.selectedItems.set(obj);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  registerOnChange(fn: (value: SelectItemView[]) => void): void {
    this.notifyOnChange.set(fn);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  registerOnTouched(fn: any): void {
    this.notifyOnTouched.set(fn);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  protected onChange(items: SelectItemView[]) {
    this.selectedItems.set(items);
    this.notifyOnChange()?.(items);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  protected onBlur() {
    this.notifyOnTouched()?.();
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
  readonly requiredInput = input(false, { transform: booleanAttribute, alias: "required" });
  readonly required: Signal<boolean> = computed(() => {
    this.controlEvent();
    return (
      this.requiredInput() || (this.ngControl?.control?.hasValidator(Validators.required) ?? false)
    );
  });

  /**Implemented as part of BitFormFieldControl */
  get error(): [string, any] {
    const errors = this.ngControl?.errors ?? {};
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  }
}
