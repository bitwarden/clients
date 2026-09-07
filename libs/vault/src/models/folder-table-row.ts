import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

export type FolderTableRow = {
  id: string;
  name: string;
  /** An em-dash stands in for a folder with no name. */
  displayName: string;
  itemCount: number;
};

const EMPTY_NAME_PLACEHOLDER = "—";

/**
 * `folderViews$` includes a synthetic "No folder" entry with an empty id. Item counts exclude
 * trashed ciphers and include archived ones.
 */
export function buildFolderRows(
  folders: FolderView[],
  ciphers: CipherViewLike[],
): FolderTableRow[] {
  const countsByFolderId = new Map<string, number>();

  for (const cipher of ciphers) {
    if (
      CipherViewLikeUtils.isDeleted(cipher) ||
      cipher.folderId == null ||
      cipher.folderId === ""
    ) {
      continue;
    }
    const folderId = String(cipher.folderId);
    countsByFolderId.set(folderId, (countsByFolderId.get(folderId) ?? 0) + 1);
  }

  return folders
    .filter((folder) => folder.id != null && folder.id !== "")
    .map((folder) => ({
      id: folder.id,
      name: folder.name ?? "",
      displayName: folder.name?.trim() ? folder.name : EMPTY_NAME_PLACEHOLDER,
      itemCount: countsByFolderId.get(folder.id) ?? 0,
    }));
}
