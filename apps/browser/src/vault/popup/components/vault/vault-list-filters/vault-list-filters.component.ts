import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { combineLatest, map, shareReplay, startWith } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { ChipFilterComponent } from "@bitwarden/components";
import { Vfo1I18nPipe, Vfo1IconPipe } from "@bitwarden/vault";

import { VaultPopupListFiltersService } from "../../../services/vault-popup-list-filters.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-list-filters",
  templateUrl: "./vault-list-filters.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ChipFilterComponent,
    ReactiveFormsModule,
    Vfo1I18nPipe,
    Vfo1IconPipe,
  ],
})
export class VaultListFiltersComponent {
  private readonly destroyRef = inject(DestroyRef);

  protected filterForm = this.vaultPopupListFiltersService.filterForm;
  protected organizations$ = this.vaultPopupListFiltersService.organizations$;
  protected collections$ = this.vaultPopupListFiltersService.collections$;
  protected folders$ = this.vaultPopupListFiltersService.folders$;
  protected cipherTypes$ = this.vaultPopupListFiltersService.cipherTypes$;

  /**
   * Single-select stand-ins for the multi-select `collection` and `folder` filters, since
   * `bit-chip-filter` holds one value and can't bind to those controls with `formControlName`.
   * This header only renders while `VFO1Foundation` is off, so these narrow each filter to one
   * selection for as long as the flag can be flipped back, and are dropped with the component.
   */
  protected readonly singleCollection = new FormControl<CollectionView | null>(null);
  protected readonly singleFolder = new FormControl<FolderView | null>(null);

  // Combine all filters into a single observable to eliminate the filters from loading separately in the UI.
  protected allFilters$ = combineLatest([
    this.organizations$,
    this.collections$,
    this.folders$,
  ]).pipe(
    map(([organizations, collections, folders]) => {
      return {
        organizations,
        collections,
        folders,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  constructor(private vaultPopupListFiltersService: VaultPopupListFiltersService) {
    this.bindSingleSelect(this.singleCollection, this.filterForm.controls.collection);
    this.bindSingleSelect(this.singleFolder, this.filterForm.controls.folder);
  }

  /**
   * Keeps a single-select chip control and its multi-select filter control in step. The filter
   * control stays authoritative: a chip selection replaces the filter, while a write from
   * anywhere else surfaces as its first selection — the only one representable here. Any remaining
   * selections stay applied to the vault.
   */
  private bindSingleSelect<T>(chip: FormControl<T | null>, filter: FormControl<T[]>): void {
    filter.valueChanges
      .pipe(startWith(filter.value), takeUntilDestroyed(this.destroyRef))
      // `emitEvent: false` so reflecting the filter here doesn't echo back into it.
      .subscribe((values) => chip.setValue(values[0] ?? null, { emitEvent: false }));

    chip.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => filter.setValue(value == null ? [] : [value]));
  }
}
