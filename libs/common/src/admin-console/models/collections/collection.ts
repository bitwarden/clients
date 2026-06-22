import { Collection as SdkCollection } from "@bitwarden/sdk-internal";

import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { asUuid, uuidAsString } from "../../../platform/abstractions/sdk/sdk.service";
import Domain from "../../../platform/models/domain/domain-base";
import { CollectionId, OrganizationId } from "../../../types/guid";
import { OrgKey } from "../../../types/key";

import { CollectionData } from "./collection.data";

import { CollectionView } from ".";

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
  defaultUserCollectionEmail: string | undefined;

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
    collection.defaultUserCollectionEmail = obj.defaultUserCollectionEmail;

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

  /**
   * Creates a Collection domain model from the SDK Collection returned by SDK encrypt operations.
   */
  static fromSdkCollection(sdkCollection: SdkCollection): Collection {
    const collection = new Collection({
      id: sdkCollection.id
        ? (uuidAsString(sdkCollection.id) as CollectionId)
        : ("" as CollectionId),
      organizationId: uuidAsString(sdkCollection.organizationId) as OrganizationId,
      name: new EncString(sdkCollection.name as unknown as string),
    });
    collection.externalId = sdkCollection.externalId;
    collection.hidePasswords = sdkCollection.hidePasswords;
    collection.readOnly = sdkCollection.readOnly;
    collection.manage = sdkCollection.manage;
    collection.defaultUserCollectionEmail = sdkCollection.defaultUserCollectionEmail;
    collection.type = sdkCollection.type;
    return collection;
  }

  /**
   * Maps Collection to SDK format for use with the SDK crypto operations.
   */
  toSdkCollection(): SdkCollection {
    return {
      id: this.id ? asUuid(this.id) : undefined,
      organizationId: asUuid(this.organizationId),
      name: this.name.toSdk(),
      externalId: this.externalId,
      hidePasswords: this.hidePasswords,
      readOnly: this.readOnly,
      manage: this.manage,
      defaultUserCollectionEmail: this.defaultUserCollectionEmail,
      type: this.type,
    };
  }

  // @TODO: This would be better off in Collection.Utils. Move this there when
  // refactoring to a shared lib.
  static isCollectionId(id: any): id is CollectionId {
    return typeof id === "string" && id != null;
  }
}
