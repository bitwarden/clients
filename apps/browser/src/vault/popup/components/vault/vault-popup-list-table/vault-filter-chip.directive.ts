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

/** A filter value that carries an id — every filter except `cipherType`, which is a scalar. */
type IdentifiableFilterValue = { id?: string | null };

/**
 * Bridges a `bit-filter-menu` chip to a control on `VaultPopupListFiltersService.filterForm`.
 *
 * The chips aren't `ControlValueAccessor`s, but `filterForm` has to stay authoritative —
 * `filterFunction$`, the view-cache serialization, the other option streams, and the non-table
 * vault header all read or write it. So this syncs both ways instead of moving state onto the chip.
 * Values stay whole domain objects (`Organization`, `CollectionView`, `FolderView`) to match
 * `PopupListFilter`; a `multiple` chip holds an array of them.
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

  /** The `filterForm` control this chip drives. */
  readonly key = input.required<VaultFilterKey>({ alias: "bitVaultFilterChip" });

  /**
   * The chip's options, so a form value can be resolved to the instance the options hold.
   *
   * `FilterMenuComponent.isSelected` matches by reference, but the form's value is routinely an
   * equal-but-distinct object (the view cache rebuilds "My vault"; `getAllFoldersNested` copies each
   * `FolderView` per emission). Seeding the raw value would leave the chip active but label-less,
   * with nothing marked selected in the menu or the responsive dialog.
   */
  readonly filterOptions = input<ChipFilterOption<unknown>[]>([]);

  /** Set while one side is writing, so the other's notification isn't bounced back. */
  private syncing = false;

  /**
   * The form control this chip drives, widened to the union of every filter value: indexing
   * `filterForm.controls` with the `VaultFilterKey` union gives a union of `FormControl`s whose
   * `setValue` parameter narrows to `never`, and the chip round-trips whatever it was seeded with.
   */
  private get formControl(): FormControl<PopupListFilter[VaultFilterKey] | null> {
    return this.filtersService.filterForm.controls[this.key()] as FormControl<
      PopupListFilter[VaultFilterKey] | null
    >;
  }

  /**
   * The cleared value for this chip's control. `PopupListFilter` uses `[]` for the multi-select
   * filters, so the chip never writes `null` over an empty array.
   */
  private get emptyValue(): unknown {
    return this.group.multiple() ? [] : null;
  }

  /** {@link resolveOne} over `value`, element-wise for a multi-select filter. */
  private resolveToOption(value: unknown): unknown {
    if (this.group.multiple()) {
      const values = Array.isArray(value) ? value : value == null ? [] : [value];
      return values.map((item) => this.resolveOne(item));
    }
    return value == null ? null : this.resolveOne(value);
  }

  /**
   * The option instance equal to `value`, matched on `id` for the object-valued filters and by
   * identity for `cipherType`. Falls back to `value` itself when no option matches — the org filter
   * can name a folder the option list no longer contains, and `validateOrganizationChange` owns
   * that reset.
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
   * Whether two control values are the same selection. Arrays are compared element-wise because
   * every write produces a fresh one, and reference equality would bounce writes between the chip
   * and the form indefinitely.
   */
  private sameValue(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((item, index) => item === b[index]);
    }
    return a === b;
  }

  constructor() {
    // Chip → form, for selections made in either the popover menu or the responsive filter dialog.
    effect(() => {
      const raw = this.control.value();

      untracked(() => {
        if (this.syncing) {
          return;
        }
        // A multi-select chip reads back as `undefined` rather than `[]` when the table re-seeds a
        // chip it sees as inactive, which must not land on the form as a cleared value.
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
    // sync or item edit doesn't drop the chip's visible selection while the rows stay filtered.
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

    // The form may already hold filters restored from the view cache before this chip existed.
    this.control.setValue(this.resolveToOption(formControl.value));

    // Form → chip, for writes from outside the table: the vault header's own filter UI,
    // `validateOrganizationChange`, or `resetFilterForm()`.
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
