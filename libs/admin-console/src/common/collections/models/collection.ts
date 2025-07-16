import Domain, { EncryptableKeys } from "@bitwarden/common/platform/models/domain/domain-base";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrgKey } from "@bitwarden/common/types/key";

import { CollectionData } from "./collection.data";
import { CollectionView } from "./collection.view";

export const CollectionTypes = {
  SharedCollection: 0,
  DefaultUserCollection: 1,
} as const;

export type CollectionType = (typeof CollectionTypes)[keyof typeof CollectionTypes];

export class Collection extends Domain {
  id: string | undefined;
  organizationId: string | undefined;
  name: EncString | undefined;
  externalId: string | undefined;
  readOnly: boolean = false;
  hidePasswords: boolean = false;
  manage: boolean = false;
  type: CollectionType = CollectionTypes.SharedCollection;
  userDefaultCollectionEmail: string | undefined;

  constructor(obj?: CollectionData) {
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
        userDefaultCollectionEmail: null,
      },
      [
        "id",
        "organizationId",
        "readOnly",
        "hidePasswords",
        "manage",
        "type",
        "userDefaultCollectionEmail",
      ],
    );
  }

  decrypt(orgKey: OrgKey): Promise<CollectionView> {
    return this.decryptObj<Collection, CollectionView>(
      this,
      new CollectionView(this),
      ["name"] as EncryptableKeys<Domain, CollectionView>[],
      this.organizationId ?? null,
      orgKey,
    );
  }
}
