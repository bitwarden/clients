// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, forwardRef, Input, OnDestroy, OnInit } from "@angular/core";
import {
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
} from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { FormSelectionList } from "@bitwarden/angular/utils/form-selection-list";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { SelectItemView } from "@bitwarden/components/src/multi-select/models/select-item-view";

import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  CollectionPermission,
  getPermissionList,
  Permission,
} from "./access-selector.models";

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
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AccessSelectorComponent),
      multi: true,
    },
  ],
})
export class AccessSelectorComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private notifyOnChange: (v: unknown) => void;
  private notifyOnTouch: () => void;
  private pauseChangeNotification: boolean;

  /**
   * Updates the enabled/disabled state of provided row form group based on the item's readonly state.
   * If a row is enabled, it also updates the enabled/disabled state of the permission control
   * based on the current value of `permissionMode`.
   * @param controlRow - The form group for the row to update
   * @param item - The access item that is represented by the row
   */
  private updateRowControlDisableState = (
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
      if (this.permissionMode != PermissionMode.Edit) {
        controlRow.controls.permission.disable();
      }
    }
  };

  /**
   * Updates the enabled/disabled state of ALL row form groups based on each item's readonly state.
   */
  private updateAllRowControlDisableStates = () => {
    this.selectionList.forEachControlItem((controlRow, item) => {
      this.updateRowControlDisableState(controlRow as FormGroup<ControlsOf<AccessItemValue>>, item);
    });
  };

  /**
   * The internal selection list that tracks the value of this form control / component.
   * It's responsible for keeping items sorted and synced with the rendered form controls
   * @protected
   */
  protected selectionList = new FormSelectionList<AccessItemView, AccessItemValue>((item) => {
    const permissionControl = this.formBuilder.control(this.initialPermission);

    const fg = this.formBuilder.group<ControlsOf<AccessItemValue>>({
      id: new FormControl(item.id),
      type: new FormControl(item.type),
      permission: permissionControl,
    });

    this.updateRowControlDisableState(fg, item);

    return fg;
  }, this._itemComparator.bind(this));

  /**
   * Internal form group for this component.
   * @protected
   */
  protected formGroup = this.formBuilder.group({
    items: this.selectionList.formArray,
  });

  protected itemType = AccessItemType;
  protected permissionList: Permission[];
  protected initialPermission = CollectionPermission.View;

  /**
   * When disabled, the access selector will make the assumption that a readonly state is desired.
   * The PermissionMode will be set to Readonly
   * The Multi-Select control will be hidden
   * The delete action on each row item will be hidden
   * The readonly permission label/property needs to configured on the access item views being passed into the component
   */
  disabled: boolean;

  /**
   * List of all selectable items that. Sorted internally.
   */
  @Input()
  get items(): AccessItemView[] {
    return this.selectionList.allItems;
  }

  set items(val: AccessItemView[]) {
    const selected = (this.selectionList.formArray.getRawValue() ?? []).concat(
      val.filter((m) => m.readonly),
    );
    this.selectionList.populateItems(
      val.map((m) => {
        m.icon = m.icon ?? this.itemIcon(m); // Ensure an icon is set
        return m;
      }),
      selected,
    );
  }

  /**
   * Permission mode that controls if the permission form controls and column should be present.
   */
  @Input()
  get permissionMode(): PermissionMode {
    return this._permissionMode;
  }

  set permissionMode(value: PermissionMode) {
    this._permissionMode = value;
    // Update any internal permission controls
    this.updateAllRowControlDisableStates();
  }
  private _permissionMode: PermissionMode = PermissionMode.Hidden;

  /**
   * Column header for the selected items table
   */
  @Input() columnHeader: string;

  /**
   * Label used for the ng selector
   */
  @Input() selectorLabelText: string;

  /**
   * Helper text displayed under the ng selector
   */
  @Input() selectorHelpText: string;

  /**
   * Text that is shown in the table when no items are selected
   */
  @Input() emptySelectionText: string;

  /**
   * Flag for if the member roles column should be present
   */
  @Input() showMemberRoles: boolean;

  /**
   * Flag for if the group column should be present
   */
  @Input() showGroupColumn: boolean;

  /**
   * Hide the multi-select so that new items cannot be added
   */
  @Input() hideMultiSelect = false;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
  ) {}

  /** Required for NG_VALUE_ACCESSOR */
  registerOnChange(fn: any): void {
    this.notifyOnChange = fn;
  }

  /** Required for NG_VALUE_ACCESSOR */
  registerOnTouched(fn: any): void {
    this.notifyOnTouch = fn;
  }

  /** Required for NG_VALUE_ACCESSOR */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;

    // Keep the internal FormGroup in sync
    if (this.disabled) {
      this.permissionMode = PermissionMode.Readonly;
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
    // Modifying the selection list, mistakenly fires valueChanges in the
    // internal form array, so we need to know to pause external notification
    this.pauseChangeNotification = true;

    // Always clear the internal selection list on a new value
    this.selectionList.deselectAll();

    // We need to also select any read only items to appear in the table
    this.selectionList.selectItems(this.items.filter((m) => m.readonly).map((m) => m.id));

    // If the new value is null, then we're done
    if (selectedItems == null) {
      this.pauseChangeNotification = false;
      return;
    }

    // Unable to handle other value types, throw
    if (!Array.isArray(selectedItems)) {
      throw new Error("The access selector component only supports Array form values!");
    }

    // Iterate and internally select each item
    for (const value of selectedItems) {
      this.selectionList.selectItem(value.id, value);
    }

    this.pauseChangeNotification = false;
  }

  async ngOnInit() {
    this.permissionList = getPermissionList();
    // Watch the internal formArray for changes and propagate them
    this.selectionList.formArray.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      if (!this.notifyOnChange || this.pauseChangeNotification) {
        return;
      }
      // Disabled form arrays emit values for disabled controls, we override this to emit an empty array to avoid
      // emitting values for disabled controls that are "readonly" in the table
      if (this.selectionList.formArray.disabled) {
        this.notifyOnChange([]);
        return;
      }
      this.notifyOnChange(v);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected handleBlur() {
    if (!this.notifyOnTouch) {
      return;
    }

    this.notifyOnTouch();
  }

  protected selectItems(items: SelectItemView[]) {
    this.pauseChangeNotification = true;
    this.selectionList.selectItems(items.map((i) => i.id));
    this.pauseChangeNotification = false;
    if (this.notifyOnChange != undefined) {
      this.notifyOnChange(this.selectionList.formArray.value);
    }
  }

  protected itemIcon(item: AccessItemView) {
    switch (item.type) {
      case AccessItemType.Collection:
        return "bwi-collection";
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
    return this.permissionMode == PermissionMode.Edit && !item.readonly;
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
