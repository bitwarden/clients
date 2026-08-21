import { DestroyRef, Directive, OnInit, effect, inject, input, untracked } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";

import { ChipFilterOption, FILTER_CONTROL, FILTER_GROUP } from "@bitwarden/components";

import {
  PopupListFilter,
  VaultPopupListFiltersService,
} from "../../../services/vault-popup-list-filters.service";

/** The `filterForm` controls a chip can drive. */
export type VaultFilterKey = keyof PopupListFilter;

/** A filter value that carries an id — every dimension except `cipherType`, which is a scalar. */
type IdentifiableFilterValue = { id?: string | null };

/**
 * Bridges a `bit-filter-menu` chip to a control on `VaultPopupListFiltersService.filterForm`.
 *
 * The chips own their selection (they're not `ControlValueAccessor`s), but the popup's filter state
 * has to stay on `filterForm` — `filterFunction$`, the view-cache serialization, and the other
 * filter option streams all read it, and the non-table vault header still writes it. So rather than
 * moving state ownership onto the chips, this keeps the form authoritative and syncs both ways:
 * the form seeds the chip, and the chip's edits are written back.
 *
 * Values stay whole domain objects (`Organization`, `CollectionView`, `FolderView`) to match
 * `PopupListFilter`, so `bit-filter-option [value]` binds the same objects the form holds. A
 * `multiple` chip holds an array of them, which is the shape its control carries.
 *
 * @example
 * ```html
 * <bit-filter-menu key="cipherType" bitVaultFilterChip="cipherType" [filterOptions]="cipherTypeOptions()">
 * ```
 */
@Directive({
  selector: "bit-filter-menu[bitVaultFilterChip]",
})
export class VaultFilterChipDirective implements OnInit {
  private readonly filtersService = inject(VaultPopupListFiltersService);
  private readonly control = inject(FILTER_CONTROL);
  private readonly group = inject(FILTER_GROUP);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The `filterForm` control this chip drives. Read once in `ngOnInit` — a chip is declared against
   * a fixed control, so this is a static binding rather than a reactive one.
   */
  readonly key = input.required<VaultFilterKey>({ alias: "bitVaultFilterChip" });

  /**
   * The chip's options, so a form value can be resolved to the instance the options actually hold.
   *
   * The chip matches its options by reference (`FilterMenuComponent.isSelected` compares with
   * `===`), but the form's value is routinely an equal-but-distinct object: the view cache restores
   * "My vault" as a fresh `Organization`, and `getAllFoldersNested` rebuilds a `FolderView` copy per
   * emission — so `folders$` re-emits new instances on any cipher change. Seeding the raw value
   * would leave the chip active (dismiss button, applied-count berry) but label-less, with nothing
   * marked selected in the menu or the responsive dialog.
   */
  readonly filterOptions = input<ChipFilterOption<unknown>[]>([]);

  /**
   * Guards against the two directions echoing each other: whichever side is mid-write marks itself
   * so the resulting notification from the other is ignored rather than bounced back.
   */
  private syncing = false;

  /**
   * The form control this chip drives, widened to the union of every filter value.
   *
   * `filterForm.controls[key]` is typed per-key, so indexing it with the `VaultFilterKey` union
   * gives a union of `FormControl`s whose `setValue` parameter narrows to `never`. The chip is
   * value-agnostic by design (it round-trips whatever object it was seeded with), so a single
   * widened control type is the accurate signature here.
   */
  private get formControl(): FormControl<PopupListFilter[VaultFilterKey] | null> {
    return this.filtersService.filterForm.controls[this.key()] as FormControl<
      PopupListFilter[VaultFilterKey] | null
    >;
  }

  /**
   * The empty value for this chip's control: `[]` for a multi-select dimension, `null` otherwise.
   *
   * A multi-select chip holds `[]` when cleared, and `PopupListFilter` matches that — so the two
   * sides agree on what "no selection" is, and the chip never writes `null` over an empty array.
   */
  private get emptyValue(): unknown {
    return this.group.multiple() ? [] : null;
  }

  /**
   * `value` mapped onto the instances the options actually hold — element-wise for a multi-select
   * dimension, and normalized to {@link emptyValue} when there's no selection.
   */
  private resolveToOption(value: unknown): unknown {
    if (this.group.multiple()) {
      const values = Array.isArray(value) ? value : value == null ? [] : [value];
      return values.map((item) => this.resolveOne(item));
    }
    return value == null ? null : this.resolveOne(value);
  }

  /**
   * The option instance equal to `value`, matched on `id` for the object-valued dimensions and by
   * identity for `cipherType`. Falls back to `value` itself when no option matches — the org filter
   * can name a folder the current list no longer contains, and clearing it here would fight
   * `validateOrganizationChange`, which owns that reset.
   */
  private resolveOne(value: unknown): unknown {
    if (typeof value !== "object" || value == null) {
      return value;
    }
    const id = (value as IdentifiableFilterValue).id;
    // "Items with no folder" has a falsy id, so match on the property's presence rather than truthiness.
    const match = this.filterOptions().find(
      (option) => (option.value as IdentifiableFilterValue | undefined)?.id === id,
    );
    return match ? match.value : value;
  }

  /**
   * Whether two control values are the same selection.
   *
   * Reference equality for the single-select dimensions, element-wise for the multi-select ones:
   * every write produces a fresh array (both `FilterMenuComponent.toggle` and
   * {@link resolveToOption}), so comparing arrays by reference would report a change on every
   * effect run and bounce a write between the chip and the form indefinitely.
   */
  private sameValue(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((item, index) => item === b[index]);
    }
    return a === b;
  }

  constructor() {
    // Chip → form. `value` is a signal, so this fires on every selection the user makes, whether in
    // the chip's popover menu or in the responsive filter dialog (both drive the same control).
    effect(() => {
      const raw = this.control.value();

      untracked(() => {
        if (this.syncing) {
          return;
        }
        // A multi-select chip reads back as `undefined` rather than `[]` in one case: the table
        // re-seeds a chip it sees as inactive from its own (empty) filter state. Normalizing here
        // keeps that from landing on the form as a cleared value.
        const value = raw == null ? this.emptyValue : raw;
        const formControl = this.formControl;
        if (this.sameValue(formControl.value, value)) {
          return;
        }
        this.syncing = true;
        try {
          formControl.setValue(value as PopupListFilter[VaultFilterKey]);
        } finally {
          this.syncing = false;
        }
      });
    });

    // Re-resolve the chip onto the current option instances whenever the options are rebuilt, so a
    // sync or item edit doesn't silently drop the chip's visible selection while the rows stay
    // filtered. Reads `filterOptions` as the dependency; the form value is read untracked.
    effect(() => {
      this.filterOptions();

      untracked(() => {
        const value = this.formControl.value;
        if (value == null) {
          return;
        }
        const resolved = this.resolveToOption(value);
        if (!this.sameValue(resolved, this.control.value())) {
          this.control.setValue(resolved);
        }
      });
    });
  }

  ngOnInit() {
    const formControl = this.formControl;

    // Seed the chip from the form: it may already hold filters restored from the view cache before
    // this chip ever existed.
    this.control.setValue(this.resolveToOption(formControl.value));

    // Form → chip, for writes from outside the table — the vault header's own filter UI, the
    // organization-change validation that resets collection/folder, or `resetFilterForm()`.
    formControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      if (this.syncing) {
        return;
      }
      this.syncing = true;
      try {
        this.control.setValue(this.resolveToOption(value));
      } finally {
        this.syncing = false;
      }
    });
  }
}
