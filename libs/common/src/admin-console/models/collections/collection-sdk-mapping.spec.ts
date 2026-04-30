import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import {
  Collection as SdkCollection,
  CollectionView as SdkCollectionView,
  EncString as SdkEncString,
} from "@bitwarden/sdk-internal";

import { CollectionId, OrganizationId } from "../../../types/guid";

import { Collection, CollectionType, CollectionTypes } from "./collection";
import { CollectionView } from "./collection.view";

/**
 * Helpers that produce minimally valid SDK UUIDs.
 * `asUuid` / `uuidAsString` use `.toString()` under the hood; these stand-ins are sufficient.
 */
function sdkUuid(value: string): any {
  return { toString: () => value, toUpperCase: () => value.toUpperCase() };
}

const collectionId = "bdc4ef23-1116-477e-ae73-247854af58cb" as CollectionId;
const orgId = "c5e9654f-6cc5-44c4-8e09-3d323522668c" as OrganizationId;
const encryptedName = "2.abc123|def456|ghi789" as SdkEncString;

function makeSdkCollection(overrides: Partial<SdkCollection> = {}): SdkCollection {
  return {
    id: sdkUuid(collectionId),
    organizationId: sdkUuid(orgId),
    name: encryptedName,
    externalId: undefined,
    hidePasswords: false,
    readOnly: false,
    manage: true,
    defaultUserCollectionEmail: undefined,
    type: "SharedCollection",
    ...overrides,
  };
}

function makeSdkCollectionView(overrides: Partial<SdkCollectionView> = {}): SdkCollectionView {
  return {
    id: sdkUuid(collectionId),
    organizationId: sdkUuid(orgId),
    name: "Decrypted Collection Name",
    externalId: undefined,
    hidePasswords: false,
    readOnly: false,
    manage: true,
    type: "SharedCollection",
    ...overrides,
  };
}

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  const c = new Collection({
    id: collectionId,
    organizationId: orgId,
    name: new EncString(encryptedName),
  });
  return Object.assign(c, overrides);
}

describe("Collection SDK mapping", () => {
  describe("Collection.fromSdkCollection", () => {
    it("maps all fields from the SDK collection", () => {
      const sdkCollection = makeSdkCollection({
        externalId: "ext-123",
        hidePasswords: true,
        readOnly: true,
        manage: false,
        defaultUserCollectionEmail: "user@example.com",
        type: "DefaultUserCollection",
      });

      const result = Collection.fromSdkCollection(sdkCollection);

      expect(result.externalId).toBe("ext-123");
      expect(result.hidePasswords).toBe(true);
      expect(result.readOnly).toBe(true);
      expect(result.manage).toBe(false);
      expect(result.defaultUserCollectionEmail).toBe("user@example.com");
      expect(result.type).toBe(CollectionTypes.DefaultUserCollection);
      expect(result.name).toBeInstanceOf(EncString);
    });

    it("maps SharedCollection type correctly", () => {
      const sdkCollection = makeSdkCollection({ type: "SharedCollection" });
      const result = Collection.fromSdkCollection(sdkCollection);
      expect(result.type).toBe(CollectionTypes.SharedCollection);
    });

    it("uses empty string for id when id is undefined", () => {
      const sdkCollection = makeSdkCollection({ id: undefined });
      const result = Collection.fromSdkCollection(sdkCollection);
      expect(result.id).toBe("");
    });
  });

  describe("Collection.toSdkCollection", () => {
    it("maps all fields to the SDK format", () => {
      const collection = makeCollection({
        externalId: "ext-456",
        hidePasswords: true,
        readOnly: true,
        manage: false,
        defaultUserCollectionEmail: "user@example.com",
        type: CollectionTypes.DefaultUserCollection,
      });

      const result = collection.toSdkCollection();

      expect(result.externalId).toBe("ext-456");
      expect(result.hidePasswords).toBe(true);
      expect(result.readOnly).toBe(true);
      expect(result.manage).toBe(false);
      expect(result.defaultUserCollectionEmail).toBe("user@example.com");
      expect(result.type).toBe("DefaultUserCollection");
    });

    it("maps SharedCollection type correctly", () => {
      const collection = makeCollection({ type: CollectionTypes.SharedCollection });
      const result = collection.toSdkCollection();
      expect(result.type).toBe("SharedCollection");
    });

    it("sets id to undefined when collection has no id", () => {
      const collection = makeCollection({ id: "" as CollectionId });
      const result = collection.toSdkCollection();
      expect(result.id).toBeUndefined();
    });
  });

  it("every CollectionTypes value roundtrips through toSdkCollection → fromSdkCollection", () => {
    for (const value of Object.values(CollectionTypes) as CollectionType[]) {
      const collection = makeCollection({ type: value });
      const sdkCollection = collection.toSdkCollection();
      const result = Collection.fromSdkCollection(sdkCollection);
      expect(result.type).toBe(value);
    }
  });
});

describe("CollectionView SDK mapping", () => {
  describe("CollectionView.fromSdkCollectionView", () => {
    it("maps all fields from the SDK view", () => {
      const sdkView = makeSdkCollectionView({
        externalId: "ext-789",
        hidePasswords: true,
        readOnly: true,
        manage: false,
        type: "DefaultUserCollection",
      });
      const source = makeCollection();

      const result = CollectionView.fromSdkCollectionView(sdkView, source);

      expect(result.name).toBe("Decrypted Collection Name");
      expect(result.externalId).toBe("ext-789");
      expect(result.hidePasswords).toBe(true);
      expect(result.readOnly).toBe(true);
      expect(result.manage).toBe(false);
      expect(result.assigned).toBe(true);
      expect(result.type).toBe(CollectionTypes.DefaultUserCollection);
    });

    it("maps SharedCollection type correctly", () => {
      const sdkView = makeSdkCollectionView({ type: "SharedCollection" });
      const source = makeCollection();
      const result = CollectionView.fromSdkCollectionView(sdkView, source);
      expect(result.type).toBe(CollectionTypes.SharedCollection);
    });

    it("uses empty string for id when sdkView.id is undefined", () => {
      const sdkView = makeSdkCollectionView({ id: undefined });
      const source = makeCollection();
      const result = CollectionView.fromSdkCollectionView(sdkView, source);
      expect(result.id).toBe("");
    });

    it("always sets assigned to true", () => {
      const sdkView = makeSdkCollectionView();
      const source = makeCollection();
      const result = CollectionView.fromSdkCollectionView(sdkView, source);
      expect(result.assigned).toBe(true);
    });

    describe("defaultUserCollectionEmail preservation (canEditName security invariant)", () => {
      it("copies defaultUserCollectionEmail from the source collection, not the SDK view", () => {
        const email = "offboarded-user@example.com";
        const sdkView = makeSdkCollectionView({ type: "DefaultUserCollection" });
        const source = makeCollection({
          defaultUserCollectionEmail: email,
          type: CollectionTypes.DefaultUserCollection,
        });

        const result = CollectionView.fromSdkCollectionView(sdkView, source);

        expect(result.defaultUserCollectionEmail).toBe(email);
      });

      it("leaves defaultUserCollectionEmail undefined for regular collections", () => {
        const sdkView = makeSdkCollectionView({ type: "SharedCollection" });
        const source = makeCollection({ defaultUserCollectionEmail: undefined });

        const result = CollectionView.fromSdkCollectionView(sdkView, source);

        expect(result.defaultUserCollectionEmail).toBeUndefined();
      });

      it("canEditName returns false when defaultUserCollectionEmail is present", () => {
        const sdkView = makeSdkCollectionView({ type: "DefaultUserCollection" });
        const source = makeCollection({
          defaultUserCollectionEmail: "offboarded@example.com",
          type: CollectionTypes.DefaultUserCollection,
        });

        const result = CollectionView.fromSdkCollectionView(sdkView, source);
        result.manage = true;

        // canEditName should be false because defaultUserCollectionEmail is set
        const mockOrg: any = { canManageAllCollections: true };
        expect(result.canEditName(mockOrg)).toBe(false);
      });

      it("canEditName is not silently bypassed when email is present — SDK path matches legacy path", () => {
        // This test asserts the security invariant stated in the WARNING on canEditName():
        // a DefaultUserCollection with a set defaultUserCollectionEmail must never be editable.
        const email = "ghost@example.com";
        const sdkView = makeSdkCollectionView({ type: "DefaultUserCollection" });
        const source = makeCollection({
          defaultUserCollectionEmail: email,
          type: CollectionTypes.DefaultUserCollection,
        });

        const sdkPathResult = CollectionView.fromSdkCollectionView(sdkView, source);
        sdkPathResult.manage = true;

        expect(sdkPathResult.defaultUserCollectionEmail).toBe(email);
        const mockOrg: any = { canManageAllCollections: true };
        expect(sdkPathResult.canEditName(mockOrg)).toBe(false);
      });
    });
  });

  describe("CollectionView.toSdkCollectionView", () => {
    it("maps all fields to the SDK format", () => {
      const view = new CollectionView({
        id: collectionId,
        organizationId: orgId,
        name: "My Collection",
      });
      view.externalId = "ext-111";
      view.hidePasswords = true;
      view.readOnly = false;
      view.manage = true;
      view.type = CollectionTypes.DefaultUserCollection;

      const result = view.toSdkCollectionView();

      expect(result.name).toBe("My Collection");
      expect(result.externalId).toBe("ext-111");
      expect(result.hidePasswords).toBe(true);
      expect(result.readOnly).toBe(false);
      expect(result.manage).toBe(true);
      expect(result.type).toBe("DefaultUserCollection");
    });

    it("maps SharedCollection type correctly", () => {
      const view = new CollectionView({ id: collectionId, organizationId: orgId, name: "Test" });
      view.type = CollectionTypes.SharedCollection;
      const result = view.toSdkCollectionView();
      expect(result.type).toBe("SharedCollection");
    });

    it("sets id to undefined when view has no id", () => {
      const view = new CollectionView({ id: "" as CollectionId, organizationId: orgId, name: "" });
      const result = view.toSdkCollectionView();
      expect(result.id).toBeUndefined();
    });
  });

  it("every CollectionTypes value roundtrips through toSdkCollectionView → fromSdkCollectionView", () => {
    for (const value of Object.values(CollectionTypes) as CollectionType[]) {
      const view = new CollectionView({ id: collectionId, organizationId: orgId, name: "Test" });
      view.type = value;
      const sdkView = view.toSdkCollectionView();
      const source = makeCollection({ type: value });
      const result = CollectionView.fromSdkCollectionView(sdkView, source);
      expect(result.type).toBe(value);
    }
  });
});
