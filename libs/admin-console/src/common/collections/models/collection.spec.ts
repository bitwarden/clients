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

  it("Convert from empty", () => {
    const data = new CollectionData({} as any);
    const card = new Collection(data);

    expect(card).toEqual({
      externalId: null,
      hidePasswords: null,
      id: null,
      name: null,
      organizationId: null,
      readOnly: null,
      manage: null,
      type: null,
    });
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
    const collection = new Collection();
    collection.id = "id";
    collection.organizationId = "orgId" as OrganizationId;
    collection.name = mockEnc("encName");
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
