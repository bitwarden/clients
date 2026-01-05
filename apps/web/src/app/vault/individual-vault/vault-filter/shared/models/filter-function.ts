import { Unassigned } from "@bitwarden/admin-console/common";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { All, RoutedVaultFilterModel } from "./routed-vault-filter.model";

export type FilterFunction = (cipher: CipherViewLike) => boolean;

export function createFilterFunction(
  filter: RoutedVaultFilterModel,
  archiveEnabled?: boolean,
): FilterFunction {
  return (cipher) => {
    const type = CipherViewLikeUtils.getType(cipher);
    const isDeleted = CipherViewLikeUtils.isDeleted(cipher);

    if (filter.type === "favorites" && !cipher.favorite) {
      return false;
    }
    if (filter.type === "card" && type !== CipherType.Card) {
      return false;
    }
    if (filter.type === "identity" && type !== CipherType.Identity) {
      return false;
    }
    if (filter.type === "login" && type !== CipherType.Login) {
      return false;
    }
    if (filter.type === "note" && type !== CipherType.SecureNote) {
      return false;
    }
    if (filter.type === "sshKey" && type !== CipherType.SshKey) {
      return false;
    }
    if (filter.type === "trash" && !isDeleted) {
      return false;
    }
    // Hide trash unless explicitly selected
    if (filter.type !== "trash" && isDeleted) {
      return false;
    }
    // Archive filter logic is only applied if the feature flag is enabled
    if (archiveEnabled) {
      if (filter.type === "archive" && !CipherViewLikeUtils.isArchived(cipher)) {
        return false;
      }
      if (filter.type !== "archive" && CipherViewLikeUtils.isArchived(cipher)) {
        return false;
      }
    }
    // No folder
    if (filter.folderId === Unassigned && cipher.folderId != null) {
      return false;
    }
    // Folder
    if (
      filter.folderId !== undefined &&
      filter.folderId !== All &&
      filter.folderId !== Unassigned &&
      cipher.folderId !== filter.folderId
    ) {
      return false;
    }
    // All collections (top level)
    if (filter.collectionId === All) {
      return false;
    }
    // Unassigned
    if (
      filter.collectionId === Unassigned &&
      (cipher.organizationId == null ||
        (cipher.collectionIds != null && cipher.collectionIds.length > 0))
    ) {
      return false;
    }
    // Collection
    if (
      filter.collectionId !== undefined &&
      filter.collectionId !== All &&
      filter.collectionId !== Unassigned &&
      (cipher.collectionIds == null || !cipher.collectionIds.includes(filter.collectionId as any))
    ) {
      return false;
    }
    // My Vault
    if (filter.organizationId === Unassigned && cipher.organizationId != null) {
      return false;
    }
    // Organization
    else if (
      filter.organizationId !== undefined &&
      filter.organizationId !== Unassigned &&
      cipher.organizationId !== filter.organizationId
    ) {
      return false;
    }

    return true;
  };
}
