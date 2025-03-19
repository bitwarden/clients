// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AbstractControl, FormArray } from "@angular/forms";

export type SelectionItemId = {
  id: string;
};

function findSortedIndex<T>(sortedArray: T[], val: T, compareFn: (a: T, b: T) => number) {
  let low = 0;
  let high = sortedArray.length || 0;
  let mid = -1,
    c = 0;
  while (low < high) {
    mid = Math.floor((low + high) / 2);
    c = compareFn(sortedArray[mid], val);
    if (c < 0) {
      low = mid + 1;
    } else if (c > 0) {
      high = mid;
    } else {
      return mid;
    }
  }
  return low;
}

/**
 * Utility to help manage a list of selectable items for use with Reactive Angular forms and FormArrays.
 *
 * It supports selecting/deselecting items, keeping items sorted, and synchronizing the selected items
 * with an array of FormControl.
 *
 * The first type parameter TItem represents the item being selected/deselected, it must have an `id`
 * property for identification/comparison. The second type parameter TControlValue represents the value
 * type of the form control.
 */
export class FormSelectionList<
  TItem extends SelectionItemId,
  TControlValue extends SelectionItemId,
> {
  allItems: TItem[] = [];
  /**
   * Sorted list of selected items
   * Immutable and should be recreated whenever a modification is made
   */
  selectedItems: TItem[] = [];

  /**
   * Sorted list of deselected items
   * Immutable and should be recreated whenever a modification is made
   */
  deselectedItems: TItem[] = [];

  /**
   * Sorted FormArray that corresponds and stays in sync with the selectedItems
   */
  formArray: FormArray<AbstractControl<Partial<TControlValue>, TControlValue>> = new FormArray([]);

  /**
   * Construct a new FormSelectionList
   * @param controlFactory - Factory responsible for creating initial form controls for each selected item. It is
   * provided a copy of the selected item for any form control initialization logic. Specify any additional form
   * control options or validators here.
   * @param compareFn - Comparison function used for sorting the items.
   */
  constructor(
    private controlFactory: (item: TItem) => AbstractControl<Partial<TControlValue>, TControlValue>,
    private compareFn: (a: TItem, b: TItem) => number,
  ) {}

  /**
   * Select multiple items by their ids at once. Optionally provide an initial form control value.
   * @param ids - List of ids to select
   * @param initialValue - Value that will be applied to the corresponding form controls
   * The provided `id` arguments will be automatically assigned to each form control value
   */
  selectItems(ids: string[], initialValue?: Partial<TControlValue> | undefined) {
    for (const id of ids) {
      this.selectItem(id, initialValue);
    }
  }

  /**
   * Deselect multiple items by their ids at once
   * @param ids - List of ids to deselect
   */
  deselectItems(ids: string[]) {
    for (const id of ids) {
      this.deselectItem(id);
    }
  }

  deselectAll() {
    this.formArray.clear();
    this.selectedItems = [];
    this.deselectedItems = [...this.allItems];
  }

  /**
   * Select a single item by id.
   *
   * Maintains list order for both selected items, deselected items, and the FormArray.
   *
   * @param id - Id of the item to select
   * @param initialValue - Value that will be applied to the corresponding form control for the selected item.
   * The provided `id` argument will be automatically assigned unless explicitly set in the initialValue.
   */
  selectItem(id: string, initialValue?: Partial<TControlValue>) {
    const index = this.deselectedItems.findIndex((o) => o.id === id);

    if (index === -1) {
      return;
    }

    const selectedOption = this.deselectedItems[index];

    // Note: Changes to the deselected/selected arrays must create a new copy of the array
    // in order for Angular's Change Detection to pick up the modification (i.e. treat the arrays as immutable)

    // Remove from the list of deselected options
    this.deselectedItems = [
      ...this.deselectedItems.slice(0, index),
      ...this.deselectedItems.slice(index + 1),
    ];

    // Insert into the sorted selected options list
    const sortedInsertIndex = findSortedIndex(this.selectedItems, selectedOption, this.compareFn);

    this.selectedItems = [
      ...this.selectedItems.slice(0, sortedInsertIndex),
      selectedOption,
      ...this.selectedItems.slice(sortedInsertIndex),
    ];

    const newControl = this.controlFactory(selectedOption);

    // Patch the value and ensure the `id` is set
    newControl.patchValue({
      id,
      ...initialValue,
    });

    this.formArray.insert(sortedInsertIndex, newControl);
  }

  /**
   * Deselect a single item by id.
   *
   * Maintains list order for both selected items, deselected items, and the FormArray.
   *
   * @param id - Id of the item to deselect
   */
  deselectItem(id: string) {
    const index = this.selectedItems.findIndex((o) => o.id === id);

    if (index === -1) {
      return;
    }

    const deselectedOption = this.selectedItems[index];

    // Note: Changes to the deselected/selected arrays must create a new copy of the array
    // in order for Angular's Change Detection to pick up the modification (i.e. treat the arrays as immutable)

    // Remove from the list of selected items (and FormArray)
    this.selectedItems = [
      ...this.selectedItems.slice(0, index),
      ...this.selectedItems.slice(index + 1),
    ];
    this.formArray.removeAt(index);

    // Insert into the sorted deselected array
    const sortedInsertIndex = findSortedIndex(
      this.deselectedItems,
      deselectedOption,
      this.compareFn,
    );

    this.deselectedItems = [
      ...this.deselectedItems.slice(0, sortedInsertIndex),
      deselectedOption,
      ...this.deselectedItems.slice(sortedInsertIndex),
    ];
  }

  /**
   * Populate the list of deselected items, and optional specify which items should be selected and with what initial
   * value for their Form Control
   * @param items - A list of all items. (Will be sorted internally)
   * @param selectedItems - The items to select initially
   */
  populateItems(items: TItem[], selectedItems: TControlValue[] = []) {
    this.formArray.clear();
    this.allItems = [...items].sort(this.compareFn);
    this.selectedItems = [];
    this.deselectedItems = [...this.allItems];

    for (const selectedItem of selectedItems) {
      this.selectItem(selectedItem.id, selectedItem);
    }
  }

  /**
   * Helper method to iterate over each "selected" form control and its corresponding item
   * @param fn - The function to call for each form control and its corresponding item
   */
  forEachControlItem(
    fn: (control: AbstractControl<Partial<TControlValue>, TControlValue>, value: TItem) => void,
  ) {
    for (let i = 0; i < this.formArray.length; i++) {
      // The selectedItems array and formArray are explicitly kept in sync,
      // so we can safely assume the index of the form control and item are the same
      fn(this.formArray.at(i), this.selectedItems[i]);
    }
  }
}
