import {
  CollectionType,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections";
import { CollectionType as SdkCollectionType } from "@bitwarden/sdk-internal";

import { toSdkCollectionType } from "./sdk-collection-type";

describe("toSdkCollectionType", () => {
  const cases: [CollectionType, SdkCollectionType][] = [
    [CollectionTypes.SharedCollection, SdkCollectionType.SharedCollection],
    [CollectionTypes.DefaultUserCollection, SdkCollectionType.DefaultUserCollection],
  ];

  it.each(cases)(
    "maps client type %i to the SDK type with the same numeric value",
    (client, sdk) => {
      const mapped = toSdkCollectionType(client);
      expect(mapped).toBe(sdk);
      // The cast-free contract relies on the numeric values staying aligned.
      expect(mapped).toBe(client as number);
    },
  );
});
