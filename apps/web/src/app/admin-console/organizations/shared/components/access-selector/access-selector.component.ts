import { NgClass } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from "@angular/forms";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { FormSelectionList } from "@bitwarden/angular/utils/form-selection-list";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  A11yTitleDirective,
  BadgeComponent,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
  TableModule,
} from "@bitwarden/components";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { SelectItemView } from "@bitwarden/components/src/multi-select/models/select-item-view";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  CollectionPermission,
  getPermissionList,
  Permission,
} from "./access-selector.models";
import { UserTypePipe } from "./user-type.pipe";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum PermissionMode {
  /**
   * No permission controls or column present. No permission values are emitted.
   */
  Hidden = "hidden",

  /**
   * No permission controls. Column rendered an if available on an item. No permission values are emitted
   */
  Readonly = "readonly",

  /**
   * Permission Controls and column present. Permission values are emitted.
   */
  Edit = "edit",
}

@Component({
  selector: "bit-access-selector",
  templateUrl: "access-selector.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AccessSelectorComponent),
      multi: true,
    },
  ],
  imports: [
    A11yTitleDirective,
    BadgeComponent,
    FormFieldModule,
    FormsModule,
    I18nPipe,
    IconButtonModule,
    NgClass,
    ReactiveFormsModule,
    SelectModule,
    TableModule,
    UserTypePipe,
  ],
})
export class AccessSelectorComponent implements ControlValueAccessor {
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);

  private readonly notifyOnChange = signal<((v: unknown) => void) | null>(null);
  private readonly notifyOnTouch = signal<(() => void) | null>(null);
  private readonly pauseChangeNotification = signal(false);

  /**
   * Updates the enabled/disabled state of provided row form group based on the item's readonly state.
   * If a row is enabled, it also updates the enabled/disabled state of the permission control
   * based on the current value of `permissionMode`.
   * @param controlRow - The form group for the row to update
   * @param item - The access item that is represented by the row
   */
  private readonly updateRowControlDisableState = (
    controlRow: FormGroup<ControlsOf<AccessItemValue>>,
    item: AccessItemView,
  ) => {
    // Disable entire row form group if readonly
    if (item.readonly) {
      controlRow.disable();
    } else {
      controlRow.enable();

      // The enable() above also enables the permission control, so we need to disable it again
      // Disable permission control if not in Edit mode
      if (this.permissionMode() != PermissionMode.Edit) {
        controlRow.controls.permission?.disable();
      }
    }
  };

  /**
   * Updates the enabled/disabled state of ALL row form groups based on each item's readonly state.
   */
  private readonly updateAllRowControlDisableStates = () => {
    this.selectionList.forEachControlItem((controlRow, item) => {
      this.updateRowControlDisableState(controlRow as FormGroup<ControlsOf<AccessItemValue>>, item);
    });
  };

  /**
   * The internal selection list that tracks the value of this form control / component.
   * It's responsible for keeping items sorted and synced with the rendered form controls
   * @protected
   */
  protected readonly selectionList = new FormSelectionList<AccessItemView, AccessItemValue>(
    (item) => {
      const permissionControl = this.formBuilder.control(this.initialPermissionValue(), {
        nonNullable: true,
      });

      const fg = this.formBuilder.group<ControlsOf<AccessItemValue>>({
        id: new FormControl(item.id, { nonNullable: true }),
        type: new FormControl(item.type, { nonNullable: true }),
        permission: permissionControl,
      });

      this.updateRowControlDisableState(fg, item);

      return fg;
    },
    this._itemComparator.bind(this),
  );

  /**
   * Internal form group for this component.
   * @protected
   */
  protected readonly formGroup = this.formBuilder.group({
    items: this.selectionList.formArray,
  });

  protected readonly itemType = AccessItemType;
  protected readonly permissionList: Permission[];

  /**
   * When disabled, the access selector will make the assumption that a readonly state is desired.
   * The PermissionMode will be set to Readonly
   * The Multi-Select control will be hidden
   * The delete action on each row item will be hidden
   * The readonly permission label/property needs to configured on the access item views being passed into the component
   */
  protected readonly disabled = signal(false);

  /**
   * List of all selectable items. Sorted internally.
   */
  readonly items = input<AccessItemView[]>([]);

  /**
   * Permission mode that controls if the permission form controls and column should be present.
   */
  readonly permissionMode = input<PermissionMode>(PermissionMode.Hidden);

  /**
   * Column header for the selected items table
   */
  readonly columnHeader = input<string>();

  /**
   * Label used for the ng selector
   */
  readonly selectorLabelText = input<string>();

  /**
   * Helper text displayed under the ng selector
   */
  readonly selectorHelpText = input<string>();

  /**
   * Text that is shown in the table when no items are selected
   */
  readonly emptySelectionText = input<string>();

  /**
   * Flag for if the member roles column should be present
   */
  readonly showMemberRoles = input<boolean>();

  /**
   * Flag for if the group column should be present
   */
  readonly showGroupColumn = input<boolean>();

  /**
   * Hide the multi-select so that new items cannot be added
   */
  readonly hideMultiSelect = input(false);

  /**
   * Hide the selected items table
   */
  readonly hideTable = input(false);

  /**
   * Test ID applied to the multi-select element for automation
   */
  readonly multiSelectTestId = input<string>();

  /**
   * The initial permission that will be selected in the dialog, defaults to View.
   */
  protected readonly initialPermission = input<CollectionPermission>(CollectionPermission.View);

  protected readonly selectedItems = signal<AccessItemView[]>([]);

  /** Mutable copy used for the initial permission two-way binding in the template */
  protected readonly initialPermissionValue = signal<CollectionPermission>(
    CollectionPermission.View,
  );

  /** Holds the last value passed to writeValue so it can be re-applied when items load */
  private readonly pendingValue = signal<AccessItemValue[] | null>(null);

  constructor() {
    this.permissionList = getPermissionList();

    effect(() => {
      const val = this.items();
      const selected = (
        this.pendingValue() ??
        this.selectionList.formArray.getRawValue() ??
        []
      ).concat(val.filter((m) => m.readonly));
      this.selectionList.populateItems(
        val.map((m) => {
          m.icon = m.icon ?? this.itemIcon(m); // Ensure an icon is set
          return m;
        }),
        selected,
      );
      this.selectedItems.set([...this.selectionList.selectedItems]);
    });

    effect(() => {
      this.initialPermissionValue.set(this.initialPermission());
    });

    effect(() => {
      this.permissionMode();
      this.updateAllRowControlDisableStates();
    });

    // Watch the internal formArray for changes and propagate them
    this.selectionList.formArray.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const notify = this.notifyOnChange();
      if (!notify || this.pauseChangeNotification()) {
        return;
      }
      // Disabled form arrays emit values for disabled controls, we override this to emit an empty array to avoid
      // emitting values for disabled controls that are "readonly" in the table
      if (this.selectionList.formArray.disabled) {
        notify([]);
        return;
      }
      notify(v);
    });
  }

  /** Required for NG_VALUE_ACCESSOR */
  registerOnChange(fn: (v: unknown) => void): void {
    this.notifyOnChange.set(fn);
  }

  /** Required for NG_VALUE_ACCESSOR */
  registerOnTouched(fn: () => void): void {
    this.notifyOnTouch.set(fn);
  }

  /** Required for NG_VALUE_ACCESSOR */
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);

    // Keep the internal FormGroup in sync
    if (isDisabled) {
      this.formGroup.disable();
    } else {
      this.formGroup.enable();

      // The enable() above automatically enables all the row controls,
      // so we need to disable the readonly ones again
      this.updateAllRowControlDisableStates();
    }
  }

  /** Required for NG_VALUE_ACCESSOR */
  writeValue(selectedItems: AccessItemValue[]): void {
    if (selectedItems != null && !Array.isArray(selectedItems)) {
      throw new Error("The access selector component only supports Array form values!");
    }

    // Store the value so the items effect can apply it once items are loaded
    this.pendingValue.set(selectedItems ?? null);

    // Modifying the selection list, mistakenly fires valueChanges in the
    // internal form array, so we need to know to pause external notification
    this.pauseChangeNotification.set(true);

    // Always clear the internal selection list on a new value
    this.selectionList.deselectAll();

    // We need to also select any read only items to appear in the table
    this.selectionList.selectItems(
      this.selectionList.allItems.filter((m) => m.readonly).map((m) => m.id),
    );

    if (selectedItems != null) {
      // Iterate and internally select each item
      for (const value of selectedItems) {
        this.selectionList.selectItem(value.id, value);
      }
    }

    this.selectedItems.set([...this.selectionList.selectedItems]);
    this.pauseChangeNotification.set(false);
  }

  protected handleBlur() {
    this.notifyOnTouch()?.();
  }

  protected deselectItem(id: string) {
    this.selectionList.deselectItem(id);
    this.selectedItems.set([...this.selectionList.selectedItems]);
    this.handleBlur();
  }

  protected selectItems(items: SelectItemView[]) {
    this.pauseChangeNotification.set(true);
    this.selectionList.selectItems(items.map((i) => i.id));
    this.selectedItems.set([...this.selectionList.selectedItems]);
    this.pauseChangeNotification.set(false);
    const notify = this.notifyOnChange();
    if (notify != undefined) {
      notify(this.selectionList.formArray.value);
    }
  }

  protected addItems(items: SelectItemView[]) {
    this.selectionList.selectItems(items.map((i) => i.id));
    this.selectedItems.set([...this.selectionList.selectedItems]);
    const notify = this.notifyOnChange();
    if (notify != undefined) {
      notify(this.selectionList.formArray.value);
    }
  }

  protected onInlineSelectionChange(items: SelectItemView[]) {
    const newIds = new Set((items ?? []).map((i) => i.id));
    for (const item of [...this.selectionList.selectedItems]) {
      if (!newIds.has(item.id)) {
        this.selectionList.deselectItem(item.id);
        this.selectedItems.set([...this.selectionList.selectedItems]);
        const notify = this.notifyOnChange();
        if (notify != undefined) {
          notify(this.selectionList.formArray.value);
        }
      }
    }
  }

  protected itemIcon(item: AccessItemView) {
    switch (item.type) {
      case AccessItemType.Collection:
        return "bwi-collection-shared";
      case AccessItemType.Group:
        return "bwi-users";
      case AccessItemType.Member:
        return "bwi-user";
    }
  }

  protected permissionLabelId(perm: CollectionPermission) {
    return this.permissionList.find((p) => p.perm == perm)?.labelId;
  }

  protected canEditItemPermission(item: AccessItemView) {
    return this.permissionMode() == PermissionMode.Edit && !item.readonly && !this.disabled();
  }

  private _itemComparator(a: AccessItemView, b: AccessItemView) {
    return (
      a.type - b.type ||
      this.i18nService.collator.compare(a.listName, b.listName) ||
      this.i18nService.collator.compare(a.labelName, b.labelName) ||
      Number(b.readonly) - Number(a.readonly)
    );
  }
}
