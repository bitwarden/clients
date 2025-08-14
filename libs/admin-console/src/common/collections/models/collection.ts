import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain, { EncryptableKeys } from "@bitwarden/common/platform/models/domain/domain-base";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";

import { CollectionData } from "./collection.data";
import { CollectionView } from "./collection.view";

export const CollectionTypes = {
  SharedCollection: 0,
  DefaultUserCollection: 1,
} as const;

export type CollectionType = (typeof CollectionTypes)[keyof typeof CollectionTypes];

export class Collection extends Domain {
  id: CollectionId | undefined;
  organizationId: OrganizationId | undefined;
  name: EncString | undefined;
  externalId: string | undefined;
  readOnly: boolean = false;
  hidePasswords: boolean = false;
  manage: boolean = false;
  type: CollectionType = CollectionTypes.SharedCollection;

  constructor(obj?: CollectionData | null) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        organizationId: null,
        name: null,
        externalId: null,
        readOnly: null,
        hidePasswords: null,
        manage: null,
        type: null,
      },
      ["id", "organizationId", "readOnly", "hidePasswords", "manage", "type"],
    );
  }

  decrypt(orgKey: OrgKey): Promise<CollectionView> {
    return this.decryptObj<Collection, CollectionView>(
      this,
      new CollectionView(this),
      ["name"] as EncryptableKeys<Collection, CollectionView>[],
      this.organizationId ?? null,
      orgKey,
    );
  }
}
