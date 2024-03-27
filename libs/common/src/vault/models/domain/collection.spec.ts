import { mockEnc } from "../../../../spec";
import { CollectionId, OrganizationId } from "../../../types/guid";
import { CollectionData } from "../data/collection.data";

import { Collection } from "./collection";

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
    });
  });

  it("Convert", () => {
    const collection = new Collection(data);

    expect(collection).toEqual({
      id: "id",
      organizationId: "orgId",
      name: { encryptedString: "encName", encryptionType: 0 },
      externalId: "extId",
      readOnly: true,
      manage: true,
      hidePasswords: true,
    });
  });

  it("Decrypt", async () => {
    const collection = new Collection();
    collection.id = "id";
    collection.organizationId = "orgId";
    collection.name = mockEnc("encName");
    collection.externalId = "extId";
    collection.readOnly = false;
    collection.hidePasswords = false;
    collection.manage = true;

    const view = await collection.decrypt();

    expect(view).toEqual({
      externalId: "extId",
      hidePasswords: false,
      id: "id",
      name: "encName",
      organizationId: "orgId",
      readOnly: false,
      manage: true,
      assigned: true,
    });
  });
});
