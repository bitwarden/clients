import { Jsonify } from "type-fest";

import {
  COLLECTION_DATA,
  DeriveDefinition,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";

import { vNextCollectionService } from "../abstractions/vnext-collection.service";
import { Collection, CollectionData, CollectionView } from "../models";

export const ENCRYPTED_COLLECTION_DATA_KEY = UserKeyDefinition.record<CollectionData, CollectionId>(
  COLLECTION_DATA,
  "collections",
  {
    deserializer: (jsonData: Jsonify<CollectionData>) => CollectionData.fromJSON(jsonData),
    clearOn: ["logout"],
  },
);

export const DECRYPTED_COLLECTION_DATA_KEY = new DeriveDefinition<
  [Collection[], Record<OrganizationId, OrgKey> | null],
  CollectionView[],
  { collectionService: vNextCollectionService }
>(COLLECTION_DATA, "decryptedCollections", {
  deserializer: (obj) => obj.map((collection) => CollectionView.fromJSON(collection)),
  derive: async ([collections, orgKeys], { collectionService }) => {
    if (collections == null) {
      return [];
    }

    return await collectionService.decryptMany(collections, orgKeys);
  },
});
