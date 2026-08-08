import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  input,
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
 * Rows partition first-match-wins in declaration order. Empty groups render
 * nothing by default; project `slot="empty" content to instead
 * keep the group's header visible and show that content in place of rows (e.g. a
 * tip). Registers with the nearest ancestor `<bit-table-v2>` via DI, so a group
 * can sit anywhere in the descendant tree — including emitted by a helper.
 */
@Component({
  selector: "bit-row-group",
  template: `
    <ng-template #header><ng-content></ng-content></ng-template>
    <ng-template #empty><ng-content select="[slot=empty]"></ng-content></ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitRowGroupComponent<T = unknown> {
  /** Membership predicate: a row joins this group if it returns true and no earlier group claimed it. */
  readonly match = input.required<(row: T) => boolean>();

  /** When set, the header becomes a toggle that collapses the group's rows (open by default). */
  readonly collapsible = input(false, { transform: booleanAttribute });

  private readonly _collapsed = signal(false);

  /** Whether the group's rows are currently hidden. Only meaningful when {@link collapsible}. */
  readonly collapsed = this._collapsed.asReadonly();

  /** Flips the collapsed state; the table re-derives its render list. */
  toggle(): void {
    this._collapsed.update((collapsed) => !collapsed);
  }

  /** The projected header label, stamped by `<bit-table-v2>` once per non-empty group. */
  readonly headerTemplate = viewChild.required<TemplateRef<void>>("header");

  /** The `slot="empty"` content, stamped by `<bit-table-v2>` when the group is empty. */
  readonly emptyTemplate = viewChild.required<TemplateRef<void>>("empty");

  private readonly slotContainer = contentChild<ElementRef<HTMLElement>>("slotContainer");

  /** Whether `slot="empty"` content is projected; when true the table keeps the header and shows it in place of rows. */
  readonly hasEmptyContent = computed(() => this.slotContainer() != null);

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
