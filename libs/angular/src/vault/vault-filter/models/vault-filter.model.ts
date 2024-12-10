// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherStatus } from "./cipher-status.model";

export type VaultFilterFunction = (cipher: CipherView) => boolean;

export class VaultFilter {
  cipherType?: CipherType;
  selectedCollection = false; // This is needed because of how the "Unassigned" collection works. It has a null id.
  selectedCollectionId?: string;
  status?: CipherStatus;
  selectedFolder = false; // This is needed because of how the "No Folder" folder works. It has a null id.
  selectedFolderId?: string;
  selectedOrganizationId?: string;
  myVaultOnly = false;
  refreshCollectionsAndFolders = false;

  constructor(init?: Partial<VaultFilter>) {
    Object.assign(this, init);
  }

  resetFilter() {
    this.cipherType = null;
    this.status = null;
    this.selectedCollection = false;
    this.selectedCollectionId = null;
    this.selectedFolder = false;
    this.selectedFolderId = null;
  }

  resetOrganization() {
    this.myVaultOnly = false;
    this.selectedOrganizationId = null;
    this.resetFilter();
  }

  buildFilter(): VaultFilterFunction {
    return (cipher) => {
      let cipherPassesFilter = true;
      if (this.status === "favorites" && cipherPassesFilter) {
        cipherPassesFilter = cipher.favorite;
      }
      if (this.status === "trash" && cipherPassesFilter) {
        cipherPassesFilter = cipher.isDeleted;
      }
      if (this.cipherType != null && cipherPassesFilter) {
        cipherPassesFilter = cipher.type === this.cipherType;
      }
      if (this.selectedFolder && this.selectedFolderId == null && cipherPassesFilter) {
        cipherPassesFilter = cipher.folderId == null;
      }
      if (this.selectedFolder && this.selectedFolderId != null && cipherPassesFilter) {
        cipherPassesFilter = cipher.folderId === this.selectedFolderId;
      }
      if (this.selectedCollection && this.selectedCollectionId == null && cipherPassesFilter) {
        cipherPassesFilter =
          cipher.organizationId != null &&
          (cipher.collectionIds == null || cipher.collectionIds.length === 0);
      }
      if (this.selectedCollection && this.selectedCollectionId != null && cipherPassesFilter) {
        cipherPassesFilter =
          cipher.collectionIds != null && cipher.collectionIds.includes(this.selectedCollectionId);
      }
      if (this.selectedOrganizationId != null && cipherPassesFilter) {
        cipherPassesFilter = cipher.organizationId === this.selectedOrganizationId;
      }
      if (this.myVaultOnly && cipherPassesFilter) {
        cipherPassesFilter = cipher.organizationId === null;
      }
      return cipherPassesFilter;
    };
  }
}
