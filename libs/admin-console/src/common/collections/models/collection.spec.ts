import { MockProxy, mock } from "jest-mock-extended";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { makeSymmetricCryptoKey } from "@bitwarden/common/spec";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";

import { Collection, CollectionTypes } from "./collection";
import { CollectionData } from "./collection.data";
import { CollectionDetailsResponse } from "./collection.response";

describe("Collection", () => {
  let data: CollectionData;
  let encService: MockProxy<EncryptService>;

  beforeEach(() => {
    data = new CollectionData(
      new CollectionDetailsResponse({
        id: "id" as CollectionId,
        organizationId: "orgId" as OrganizationId,
        name: "encName",
        externalId: "extId",
        readOnly: true,
        manage: true,
        hidePasswords: true,
        type: CollectionTypes.DefaultUserCollection,
        defaultUserCollectionEmail: "defaultCollectionEmail",
      }),
    );
    encService = mock<EncryptService>();
    encService.decryptString.mockResolvedValue("encName");
  });

  it("Convert from partial", () => {
    const card = new Collection({
      name: new EncString("name"),
      organizationId: "orgId" as OrganizationId,
      id: "id" as CollectionId,
    });
    expect(() => card).not.toThrow();

    expect(card.name).not.toBe(null);
    expect(card.organizationId).not.toBe(null);
    expect(card.id).not.toBe(null);
    expect(card.externalId).toBe(undefined);
    expect(card.readOnly).toBe(false);
    expect(card.manage).toBe(false);
    expect(card.hidePasswords).toBe(false);
    expect(card.type).toEqual(CollectionTypes.SharedCollection);
  });

  it("Convert", () => {
    const collection = Collection.fromCollectionData(data);

    expect(collection).toEqual({
      id: "id",
      organizationId: "orgId",
      name: { encryptedString: "encName", encryptionType: 0 },
      externalId: "extId",
      readOnly: true,
      manage: true,
      hidePasswords: true,
      type: CollectionTypes.DefaultUserCollection,
      defaultUserCollectionEmail: "defaultCollectionEmail",
    });
  });

  it("Decrypt", async () => {
    const collection = new Collection({
      name: new EncString("encName"),
      organizationId: "orgId" as OrganizationId,
      id: "id" as CollectionId,
    });
    collection.externalId = "extId";
    collection.readOnly = false;
    collection.hidePasswords = false;
    collection.manage = true;
    collection.type = CollectionTypes.DefaultUserCollection;
    collection.defaultUserCollectionEmail = "defaultCollectionEmail";

    const key = makeSymmetricCryptoKey<OrgKey>();

    const view = await collection.decrypt(key, encService);

    expect(view).toEqual({
      externalId: "extId",
      hidePasswords: false,
      id: "id",
      _name: "encName",
      organizationId: "orgId",
      readOnly: false,
      manage: true,
      assigned: true,
      type: CollectionTypes.DefaultUserCollection,
      defaultUserCollectionEmail: "defaultCollectionEmail",
    });
  });
});
