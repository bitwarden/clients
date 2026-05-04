import { Jsonify } from "type-fest";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { View } from "@bitwarden/common/models/view/view";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";
import { CollectionView as SdkCollectionView } from "@bitwarden/sdk-internal";

import {
  Collection,
  CollectionType,
  CollectionTypes,
  collectionTypeToSdkType,
  sdkTypeToCollectionType,
} from "./collection";
import { CollectionAccessDetailsResponse } from "./collection.response";

export const NestingDelimiter = "/";

export class CollectionView implements View, ITreeNodeObject {
  id: CollectionId;
  organizationId: OrganizationId;
  externalId: string | undefined;
  // readOnly applies to the items within a collection
  readOnly: boolean = false;
  hidePasswords: boolean = false;
  manage: boolean = false;
  assigned: boolean = false;
  type: CollectionType = CollectionTypes.SharedCollection;
  defaultUserCollectionEmail: string | undefined;

  private _name: string;

  constructor(c: { id: CollectionId; organizationId: OrganizationId; name: string }) {
    this.id = c.id;
    this.organizationId = c.organizationId;
    this._name = c.name;
  }

  set name(name: string) {
    this._name = name;
  }

  get name(): string {
    return this.defaultUserCollectionEmail ?? this._name;
  }

  canEditItems(org: Organization): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    return org?.canEditAllCiphers || this.manage || (this.assigned && !this.readOnly);
  }

  /**
   * Returns true if the user can edit a collection (including user and group access) from the individual vault.
   * Does not include admin permissions - see {@link CollectionAdminView.canEdit}.
   */
  canEdit(org: Organization | undefined): boolean {
    if (this.isDefaultCollection) {
      return false;
    }

    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    return this.manage;
  }

  /**
   * Returns true if the user can delete a collection from the individual vault.
   * Does not include admin permissions - see {@link CollectionAdminView.canDelete}.
   */
  canDelete(org: Organization | undefined): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    const canDeleteManagedCollections = !org?.limitCollectionDeletion || org.isAdmin;

    // Only use individual permissions, not admin permissions
    return canDeleteManagedCollections && this.manage && !this.isDefaultCollection;
  }

  /**
   * Returns true if the user can view collection info and access in a read-only state from the individual vault
   */
  canViewCollectionInfo(org: Organization | undefined): boolean {
    return false;
  }

  /**
   * Returns true if the collection name can be edited. Editing the collection name is restricted for collections
   * that were DefaultUserCollections but where the relevant user has been offboarded.
   * When this occurs, the offboarded user's email is treated as the collection name, and cannot be edited.
   * This is important for security so that the server cannot ask the client to encrypt arbitrary data.
   * WARNING! This is an IMPORTANT restriction that MUST be maintained for security purposes.
   * Do not edit or remove this unless you understand why.
   */
  canEditName(org: Organization): boolean {
    return this.canEdit(org) && !this.defaultUserCollectionEmail;
  }

  get isDefaultCollection() {
    return this.type == CollectionTypes.DefaultUserCollection;
  }

  // FIXME: we should not use a CollectionView object for the vault filter header because it is not a real
  // CollectionView and this violates ts-strict rules.
  static vaultFilterHead(): CollectionView {
    return new CollectionView({
      id: "" as CollectionId,
      organizationId: "" as OrganizationId,
      name: "",
    });
  }

  static async fromCollection(
    collection: Collection,
    encryptService: EncryptService,
    key: OrgKey,
  ): Promise<CollectionView> {
    const view = new CollectionView({ ...collection, name: "" });

    try {
      view.name = await encryptService.decryptString(collection.name, key);
    } catch (e) {
      view.name = "[error: cannot decrypt]";
      // eslint-disable-next-line no-console
      console.error("[CollectionView] Error decrypting collection name", e);
    }

    view.assigned = true;
    view.externalId = collection.externalId;
    view.readOnly = collection.readOnly;
    view.hidePasswords = collection.hidePasswords;
    view.manage = collection.manage;
    view.type = collection.type;
    view.defaultUserCollectionEmail = collection.defaultUserCollectionEmail;
    return view;
  }

  static async fromCollectionAccessDetails(
    collection: CollectionAccessDetailsResponse,
    encryptService: EncryptService,
    orgKey: OrgKey,
  ): Promise<CollectionView> {
    const view = new CollectionView({ ...collection });

    try {
      view.name = await encryptService.decryptString(new EncString(collection.name), orgKey);
    } catch (e) {
      // Note: This should be replaced by the owning team with appropriate, domain-specific behavior.
      // eslint-disable-next-line no-console
      console.error("[CollectionView] Error decrypting collection name", e);
      throw e;
    }

    view.externalId = collection.externalId;
    view.type = collection.type;
    view.assigned = collection.assigned;
    view.defaultUserCollectionEmail = collection.defaultUserCollectionEmail;
    return view;
  }

  static fromJSON(obj: Jsonify<CollectionView>) {
    return Object.assign(new CollectionView({ ...obj }), obj);
  }

  /**
   * Creates a CollectionView from the SDK CollectionView returned by SDK decrypt operations.
   *
   * The `sourceCollection` parameter is required to preserve `defaultUserCollectionEmail`, which
   * the SDK's CollectionView type does not carry. That field is consumed by `canEditName()` to
   * enforce the security restriction that prevents editing names on offboarded default-user
   * collections (see WARNING on `canEditName`). Without it the restriction would be silently
   * bypassed on the SDK decrypt path.
   */
  static fromSdkCollectionView(
    sdkView: SdkCollectionView,
    sourceCollection: Collection,
  ): CollectionView {
    const view = new CollectionView({
      id: sdkView.id ? (uuidAsString(sdkView.id) as CollectionId) : ("" as CollectionId),
      organizationId: uuidAsString(sdkView.organizationId) as OrganizationId,
      name: sdkView.name,
    });

    view.externalId = sdkView.externalId;
    view.hidePasswords = sdkView.hidePasswords;
    view.readOnly = sdkView.readOnly;
    view.manage = sdkView.manage;
    view.assigned = true;
    view.defaultUserCollectionEmail = sourceCollection.defaultUserCollectionEmail;
    view.type = sdkTypeToCollectionType[sdkView.type];

    return view;
  }

  /**
   * Maps this CollectionView to the SDK CollectionView format for use with SDK crypto operations.
   *
   * Uses the `name` getter, which resolves `defaultUserCollectionEmail` when present, ensuring
   * the correct display name is passed to the SDK.
   */
  toSdkCollectionView(): SdkCollectionView {
    return {
      id: this.id ? asUuid(this.id) : undefined,
      organizationId: asUuid(this.organizationId),
      name: this.name,
      externalId: this.externalId,
      hidePasswords: this.hidePasswords,
      readOnly: this.readOnly,
      manage: this.manage,
      type: collectionTypeToSdkType[this.type],
    };
  }

  encrypt(orgKey: OrgKey, encryptService: EncryptService): Promise<Collection> {
    return Collection.fromCollectionView(this, encryptService, orgKey);
  }
}
