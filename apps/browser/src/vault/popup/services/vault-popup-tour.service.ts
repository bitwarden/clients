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

  async start(userId: UserId): Promise<void> {
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

    await this.coachmarkService.startTour(
      extensionVaultTour(this.stateProvider, nav.vaults.length > 1, sharedFoldersRow != null),
    );
  }
}
