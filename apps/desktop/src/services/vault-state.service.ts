import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import { VaultFilter } from "@bitwarden/angular/vault/vault-filter/models/vault-filter.model";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SearchBarService } from "../app/layout/search/search-bar.service";

/**
 * Service to coordinate vault state, including filter state and folder actions,
 * between the navigation component and the vault component.
 */
@Injectable({ providedIn: "root" })
export class VaultStateService {
  private filterChangeSubject = new Subject<VaultFilter>();
  private addFolderSubject = new Subject<void>();
  private editFolderSubject = new Subject<string>();

  /**
   * The currently active vault filter.
   */
  activeFilter: VaultFilter = new VaultFilter();

  /**
   * Observable stream of vault filter changes.
   * Subscribe to this to react to filter changes from the navigation.
   */
  readonly filterChange$ = this.filterChangeSubject.asObservable();

  /**
   * Observable stream of add folder requests.
   * Subscribe to this to handle folder creation.
   */
  readonly addFolder$ = this.addFolderSubject.asObservable();

  /**
   * Observable stream of edit folder requests.
   * Subscribe to this to handle folder editing.
   * Emits the folder ID to edit.
   */
  readonly editFolder$ = this.editFolderSubject.asObservable();

  constructor(
    private i18nService: I18nService,
    private searchBarService: SearchBarService,
  ) {}

  /**
   * Apply a new vault filter.
   * This updates the search bar placeholder and notifies all subscribers.
   */
  applyFilter(filter: VaultFilter): void {
    // Store the active filter
    this.activeFilter = filter;

    // Update search bar placeholder text based on the filter
    this.searchBarService.setPlaceholderText(
      this.i18nService.t(this.calculateSearchBarLocalizationString(filter)),
    );

    // Emit the filter change to subscribers
    this.filterChangeSubject.next(filter);
  }

  /**
   * Request to add a new folder.
   * This will notify subscribers to show the folder creation dialog.
   */
  requestAddFolder(): void {
    this.addFolderSubject.next();
  }

  /**
   * Request to edit an existing folder.
   * This will notify subscribers to show the folder edit dialog.
   */
  requestEditFolder(folderId: string): void {
    this.editFolderSubject.next(folderId);
  }

  /**
   * Calculate the appropriate search bar localization string based on the active filter.
   */
  private calculateSearchBarLocalizationString(vaultFilter: VaultFilter): string {
    if (vaultFilter.status === "favorites") {
      return "searchFavorites";
    }
    if (vaultFilter.status === "trash") {
      return "searchTrash";
    }
    if (vaultFilter.cipherType != null) {
      return "searchType";
    }
    if (vaultFilter.selectedFolderId != null && vaultFilter.selectedFolderId !== "none") {
      return "searchFolder";
    }
    if (vaultFilter.selectedCollectionId != null) {
      return "searchCollection";
    }
    if (vaultFilter.selectedOrganizationId != null) {
      return "searchOrganization";
    }
    if (vaultFilter.myVaultOnly) {
      return "searchMyVault";
    }
    return "searchVault";
  }
}
