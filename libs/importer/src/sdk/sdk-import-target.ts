import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { SdkImportContext } from "./sdk-vault-importer";

/**
 * Resolves the import target into its concrete personal-folder vs organization-collection forms.
 * A folder target only applies to personal imports; a collection target only to org imports. Shared
 * by SDK importer strategies that submit to the server, since each maps these into its own SDK
 * options shape.
 */
export function resolveSdkImportTargets(context: SdkImportContext): {
  folder?: FolderView;
  collection?: CollectionView;
} {
  const { organizationId, selectedImportTarget } = context;
  return {
    folder:
      !organizationId && selectedImportTarget instanceof FolderView
        ? selectedImportTarget
        : undefined,
    collection:
      organizationId && selectedImportTarget instanceof CollectionView
        ? selectedImportTarget
        : undefined,
  };
}
