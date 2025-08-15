import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";
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
  id: CollectionId;
  organizationId: OrganizationId;
  name: EncString;
  externalId: string | undefined;
  readOnly: boolean = false;
  hidePasswords: boolean = false;
  manage: boolean = false;
  type: CollectionType = CollectionTypes.SharedCollection;

  constructor(c: { id: CollectionId; name: EncString; organizationId: OrganizationId }) {
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

  static async fromCollectionView(
    view: CollectionView,
    encryptService: EncryptService,
    orgKey: OrgKey,
  ): Promise<Collection> {
    const collection = new Collection({
      name: await encryptService.encryptString(view.name, orgKey),
      id: view.id,
      organizationId: view.organizationId,
    });

    collection.externalId = view.externalId;
    collection.readOnly = view.readOnly;
    collection.hidePasswords = view.hidePasswords;
    collection.manage = view.manage;
    collection.type = view.type;

    return collection;
  }

  decrypt(orgKey: OrgKey, encryptService: EncryptService): Promise<CollectionView> {
    return CollectionView.fromCollection(this, encryptService, orgKey);
  }

  // @TODO: This would be better off in Collection.Utils. Move this there when
  // refactoring to a shared lib.
  static isCollectionId(id: any): id is CollectionId {
    return typeof id === "string" && id != null;
  }
}
