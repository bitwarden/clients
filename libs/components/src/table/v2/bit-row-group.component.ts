import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  TemplateRef,
  viewChild,
} from "@angular/core";

import { BitTableV2Component } from "./table-v2.component";

/**
 * Declarative row-group for `bit-table-v2`. Declares one group whose members are
 * the rows passing {@link match}; the projected content is the group's header
 * label (the row count is appended automatically by the table).
 *
 * Rows partition first-match-wins in declaration order, and a top-level group with no
 * matching rows renders nothing unless it clears {@link hideOnEmpty}. Registers with
 * the nearest ancestor `<bit-table-v2>` via DI, so a group can sit anywhere in the
 * descendant tree — including emitted by a helper.
 */
@Component({
  selector: "bit-row-group",
  template: `<ng-template #header><ng-content></ng-content></ng-template>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitRowGroupComponent<T = unknown> {
  /** Membership predicate: a row joins this group if it returns true and no earlier group claimed it. */
  readonly match = input.required<(row: T) => boolean>();

  /** When set, the header becomes a toggle that collapses the group's rows (open by default). */
  readonly collapsible = input(false, { transform: booleanAttribute });

  /**
   * Explanatory text rendered under the header, above the group's rows. Top-level groups
   * only — a nested subgroup's description is ignored.
   */
  readonly description = input<string>();

  /**
   * Whether the group disappears when no rows match. Clear it to keep the header — and
   * any {@link description} — on screen, so the description can stand in for the rows.
   * Top-level groups only; an empty nested subgroup always hides.
   */
  readonly hideOnEmpty = input(true, { transform: booleanAttribute });

  /**
   * Whether the group's rows are currently hidden. Only meaningful when {@link collapsible}.
   * Two-way bindable (`[(collapsed)]`) so a consumer can seed the initial state and persist
   * changes when the user toggles the header.
   */
  readonly collapsed = model(false);

  /** Flips the collapsed state; the table re-derives its render list. */
  toggle(): void {
    this.collapsed.update((collapsed) => !collapsed);
  }

  /** The projected header label, stamped by `<bit-table-v2>` once per rendered group. */
  readonly headerTemplate = viewChild.required<TemplateRef<void>>("header");

  private readonly _children = signal<BitRowGroupComponent<T>[]>([]);

  /** Nested subgroups, in declaration order. Only one level of nesting is supported. */
  readonly children = this._children.asReadonly();

  /** Registers a nested subgroup. Called by a child {@link BitRowGroupComponent} via DI. */
  registerChild(child: BitRowGroupComponent<T>): void {
    this._children.update((children) => [...children, child]);
  }

  /** @see {@link registerChild} */
  unregisterChild(child: BitRowGroupComponent<T>): void {
    this._children.update((children) => children.filter((c) => c !== child));
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Nested inside another group? Register as its subgroup; otherwise top-level on the table.
    const parent = inject<BitRowGroupComponent<T>>(
      forwardRef(() => BitRowGroupComponent),
      { optional: true, skipSelf: true },
    );
    if (parent) {
      parent.registerChild(this);
      destroyRef.onDestroy(() => parent.unregisterChild(this));
      return;
    }
    const table = inject<BitTableV2Component<T>>(forwardRef(() => BitTableV2Component));
    table.registerGroup(this);
    destroyRef.onDestroy(() => table.unregisterGroup(this));
  }
}
