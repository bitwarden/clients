import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SendItemView } from "@bitwarden/common/tools/send/models/view/send-item.view";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { newGuid } from "@bitwarden/guid";

/** The vault view models used to render the item of an Item Send. */
export interface SendItemVaultViews {
  cipher?: CipherView;
  folder?: FolderView;
  organization?: Organization;
  collections?: CollectionView[];
}

/**
 * Builds the vault view models for an Item Send from its unencrypted metadata. Item Sends only carry the
 * names of the folder, organization and collections in their metadata, so placeholder ids are generated
 * and linked to each other so the item details components can resolve them. The source view is not mutated.
 */
export function toSendItemVaultViews(
  sendItem: SendItemView | null | undefined,
): SendItemVaultViews {
  if (!sendItem?.data) {
    return {};
  }

  const metadata = sendItem.metadata;
  const cipher = Object.assign(new CipherView(), sendItem.data);

  let folder: FolderView | undefined;
  if (metadata?.folderName) {
    folder = new FolderView();
    folder.id = newGuid();
    folder.name = metadata.folderName;
    cipher.folderId = folder.id;
  }

  let organization: Organization | undefined;
  if (metadata?.organizationName || metadata?.collectionNames?.length) {
    organization = new Organization();
    organization.id = newGuid() as OrganizationId;
    organization.name = metadata.organizationName ?? "";
    cipher.organizationId = organization.id;
  }

  let collections: CollectionView[] | undefined;
  if (organization && metadata?.collectionNames?.length) {
    const organizationId = organization.id;
    collections = metadata.collectionNames.map(
      (name) =>
        new CollectionView({
          id: newGuid() as CollectionId,
          name,
          organizationId,
        }),
    );
    cipher.collectionIds = collections.map((collection) => collection.id);
  }

  return { cipher, folder, organization, collections };
}
