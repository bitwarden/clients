import { SelectionModel } from "@angular/cdk/collections";

/**
 * The selection model `bit-table-v2` accepts — a {@link SelectionModel} that also
 * knows which rows are *selectable*.
 *
 * The table reads {@link isSelectable} to decide whether to render a row's
 * checkbox and to scope select-all / indeterminate to selectable rows. The
 * predicate is also enforced in {@link select}, so a non-selectable row can
 * never enter the selection — even via a programmatic `select`/`toggle`.
 *
 * `canSelect` defaults to "every row selectable", so the common case is as terse
 * as a plain `SelectionModel`; supply it only when some rows aren't selectable.
 */
export class TableSelectionModel<T> extends SelectionModel<T> {
  private readonly canSelect: (value: T) => boolean;

  constructor(
    multiple = false,
    initiallySelectedValues: T[] = [],
    options: {
      emitChanges?: boolean;
      compareWith?: (o1: T, o2: T) => boolean;
      canSelect?: (value: T) => boolean;
    } = {},
  ) {
    super(multiple, initiallySelectedValues, options.emitChanges ?? true, options.compareWith);
    this.canSelect = options.canSelect ?? (() => true);
  }

  /** Whether `value` may be selected. */
  isSelectable(value: T): boolean {
    return this.canSelect(value);
  }

  /** Selects the given values, ignoring any that aren't {@link isSelectable}. */
  override select(...values: T[]): boolean {
    return super.select(...values.filter((value) => this.canSelect(value)));
  }
}
