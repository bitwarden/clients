import { inject, Injectable, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";
import { CoachmarkService, VaultNavService } from "@bitwarden/vault";

import { extensionVaultTour } from "../tours/extension-vault-tour";
import { collectionOptionsInScope, folderOptionsInScope } from "../utils/filter-options";

import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListTableFiltersService } from "./vault-popup-list-table-filters.service";
import { VaultPopupListTableService } from "./vault-popup-list-table.service";

/** The filter dialog row the shared folders step points at. */
export type SharedFoldersRow = "collection" | "folder";

/**
 * Starts the extension vault tour, deciding up front which steps the popup can anchor.
 */
@Injectable({ providedIn: "root" })
export class VaultPopupTourService {
  private readonly coachmarkService = inject(CoachmarkService);
  private readonly stateProvider = inject(StateProvider);
  private readonly vaultNavService = inject(VaultNavService);
  private readonly listTableService = inject(VaultPopupListTableService);
  private readonly listFiltersService = inject(VaultPopupListTableFiltersService);
  private readonly itemsService = inject(VaultPopupItemsService);

  private readonly _sharedFoldersRow = signal<SharedFoldersRow | null>(null);

  /**
   * The row the shared folders step anchors: Shared folders, or My folders when the scoped vault
   * lists no collections. `null` when neither renders, and the step is dropped.
   */
  readonly sharedFoldersRow = this._sharedFoldersRow.asReadonly();

  /**
   * Whether the tour holds the filter dialog open for its shared folders step. Kept apart from the
   * view-cached `VaultPopupListTableFiltersService.filterDialogOpen`, which would reopen the dialog
   * after the popup closes mid-step, when the tour itself is gone.
   */
  readonly filterDialogOpen = signal(false);

  /**
   * Starts the tour and marks it complete straight away: its progress lives only in memory, so a
   * user who closes the popup partway through doesn't get it again.
   */
  async start(userId: UserId): Promise<void> {
    // Another tour holds the coachmarks, and this one would be marked complete without showing.
    if (this.coachmarkService.isRunning()) {
      return;
    }

    const [nav, collections, folders, ciphers] = await Promise.all([
      firstValueFrom(this.vaultNavService.viewModel$(userId)),
      firstValueFrom(this.listFiltersService.collections$),
      firstValueFrom(this.listFiltersService.folders$),
      firstValueFrom(this.itemsService.activeCiphers$),
    ]);

    // Narrowed like the list table's chips, since the popup can be scoped to a single vault.
    const scope = this.listTableService.vaultScope();
    const sharedFoldersRow: SharedFoldersRow | null =
      collectionOptionsInScope(collections, scope).length > 0
        ? "collection"
        : folderOptionsInScope(folders, ciphers, scope).length > 0
          ? "folder"
          : null;
    this._sharedFoldersRow.set(sharedFoldersRow);

    const tour = extensionVaultTour(
      this.stateProvider,
      nav.vaults.length > 1,
      sharedFoldersRow != null,
    );
    await this.coachmarkService.startTour(tour);
    // `startTour` skips a tour that is already complete or has no steps, so check it is showing.
    if (this.coachmarkService.isRunning()) {
      await tour.markCompleted(userId);
    }
  }
}
