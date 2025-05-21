import { Jsonify } from "type-fest";

import { COLLECTION_DATA, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { CollectionId } from "@bitwarden/common/types/guid";

import { CollectionData, CollectionView } from "../models";

export const ENCRYPTED_COLLECTION_DATA_KEY = UserKeyDefinition.record<CollectionData, CollectionId>(
  COLLECTION_DATA,
  "collections",
  {
    deserializer: (jsonData: Jsonify<CollectionData>) => CollectionData.fromJSON(jsonData),
    clearOn: ["logout"],
  },
);

export const DECRYPTED_COLLECTION_DATA_KEY = new UserKeyDefinition<CollectionView[]>(
  COLLECTION_DATA,
  "decryptedCollections",
  {
    deserializer: (obj: Jsonify<CollectionView[]>) =>
      obj?.map((f) => CollectionView.fromJSON(f)) ?? [],
    clearOn: ["logout", "lock"],
  },
);
