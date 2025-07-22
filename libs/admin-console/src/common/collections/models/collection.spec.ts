import { makeSymmetricCryptoKey, mockEnc } from "@bitwarden/common/spec";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";

import { Collection, CollectionTypes } from "./collection";
import { CollectionData } from "./collection.data";

describe("Collection", () => {
  let data: CollectionData;

  beforeEach(() => {
    data = {
      id: "id" as CollectionId,
      organizationId: "orgId" as OrganizationId,
      name: "encName",
      externalId: "extId",
      readOnly: true,
      manage: true,
      hidePasswords: true,
      type: CollectionTypes.DefaultUserCollection,
    };
  });

  it("Throws when not provided name and organizationId", () => {
    expect(() => new Collection()).toThrow();
  });

  it("Convert from partial", () => {
    const card = new Collection({
      name: "name",
      organizationId: "orgId" as OrganizationId,
      id: "id" as CollectionId,
    });
    expect(() => card).not.toThrow();

    expect(card.name).not.toBe(null);
    expect(card.organizationId).not.toBe(null);
    expect(card.id).not.toBe(null);
    expect(card.externalId).toBe(null);
    expect(card.readOnly).toBe(null);
    expect(card.manage).toBe(null);
    expect(card.hidePasswords).toBe(null);
    expect(card.type).toEqual(null);
  });

  it("Convert", () => {
    const collection = new Collection(data);

    expect(collection).toEqual({
      id: "id",
      organizationId: "orgId",
      name: { encryptedString: "encName", encryptionType: 0 },
      externalId: { encryptedString: "extId", encryptionType: 0 },
      readOnly: true,
      manage: true,
      hidePasswords: true,
      type: CollectionTypes.DefaultUserCollection,
    });
  });

  it("Decrypt", async () => {
    const collectionData = {
      name: "encName",
      organizationId: "orgId" as OrganizationId,
      id: "id" as CollectionId,
    };
    const collection = new Collection(collectionData);
    collection.name = mockEnc(collectionData.name);
    collection.externalId = "extId";
    collection.readOnly = false;
    collection.hidePasswords = false;
    collection.manage = true;
    collection.type = CollectionTypes.DefaultUserCollection;

    const key = makeSymmetricCryptoKey<OrgKey>();

    const view = await collection.decrypt(key);

    expect(view).toEqual({
      externalId: "extId",
      hidePasswords: false,
      id: "id",
      name: "encName",
      organizationId: "orgId",
      readOnly: false,
      manage: true,
      assigned: true,
      type: CollectionTypes.DefaultUserCollection,
    });
  });
});
