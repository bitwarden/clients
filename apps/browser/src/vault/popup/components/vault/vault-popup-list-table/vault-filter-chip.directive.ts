import { DestroyRef, Directive, OnInit, effect, inject, input, untracked } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";

import { FILTER_CONTROL } from "@bitwarden/components";

import {
  PopupListFilter,
  VaultPopupListFiltersService,
} from "../../../services/vault-popup-list-filters.service";

/** The `filterForm` controls a chip can drive. */
export type VaultFilterKey = keyof PopupListFilter;

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
 * `PopupListFilter`, so `bit-filter-option [value]` binds the same objects the form holds.
 *
 * @example
 * ```html
 * <bit-filter-menu key="cipherType" bitVaultFilterChip="cipherType" placeholderText="Type">
 * ```
 */
@Directive({
  selector: "bit-filter-menu[bitVaultFilterChip]",
})
export class VaultFilterChipDirective implements OnInit {
  private readonly filtersService = inject(VaultPopupListFiltersService);
  private readonly control = inject(FILTER_CONTROL);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The `filterForm` control this chip drives. Read once in `ngOnInit` — a chip is declared against
   * a fixed control, so this is a static binding rather than a reactive one.
   */
  readonly key = input.required<VaultFilterKey>({ alias: "bitVaultFilterChip" });

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

  constructor() {
    // Chip → form. `value` is a signal, so this fires on every selection the user makes, whether in
    // the chip's popover menu or in the responsive filter dialog (both drive the same control).
    effect(() => {
      const value = this.control.value() ?? null;

      untracked(() => {
        if (this.syncing) {
          return;
        }
        const formControl = this.formControl;
        if (formControl.value === value) {
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
  }

  ngOnInit() {
    const formControl = this.formControl;

    // Seed the chip from the form: it may already hold filters restored from the view cache before
    // this chip ever existed.
    this.control.setValue(formControl.value ?? null);

    // Form → chip, for writes from outside the table — the vault header's own filter UI, the
    // organization-change validation that resets collection/folder, or `resetFilterForm()`.
    formControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      if (this.syncing) {
        return;
      }
      this.syncing = true;
      try {
        this.control.setValue(value ?? null);
      } finally {
        this.syncing = false;
      }
    });
  }
}
