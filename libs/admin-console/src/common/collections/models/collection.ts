import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { CollectionId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";

import { CollectionData } from "./collection.data";
import { CollectionView } from "./collection.view";

export const CollectionTypes = {
  SharedCollection: 0,
  DefaultUserCollection: 1,
} as const;

export type CollectionType = (typeof CollectionTypes)[keyof typeof CollectionTypes];

export class Collection extends Domain {
  id: CollectionId;
  organizationId: string;
  name: EncString;
  externalId: string | undefined;
  readOnly: boolean = false;
  hidePasswords: boolean = false;
  manage: boolean = false;
  type: CollectionType = CollectionTypes.SharedCollection;

  constructor(c: { id: CollectionId; name: EncString; organizationId: string }) {
    super();
    this.id = c.id;
    this.name = c.name;
    this.organizationId = c.organizationId;
  }

  static fromCollectionData(obj: CollectionData): Collection {
    if (obj == null || obj.name == null || obj.organizationId == null) {
      throw new Error("CollectionData must contain name and organizationId.");
    }

    const collection = new Collection({
      ...obj,
      name: new EncString(obj.name),
    });

    collection.externalId = obj.externalId;
    collection.readOnly = obj.readOnly;
    collection.hidePasswords = obj.hidePasswords;
    collection.manage = obj.manage;
    collection.type = obj.type;

    return collection;
  }

  decrypt(orgKey: OrgKey, encryptService: EncryptService): Promise<CollectionView> {
    return CollectionView.fromCollection(this, encryptService, orgKey);
  }
}
