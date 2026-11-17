import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { sharedFolderDisplayName, sharedFolderName } from "./shared-folder-name";

describe("sharedFolderName", () => {
  it.each([
    ["Engineering", "Engineering"],
    ["Top level/Next/Deeper/Deepest", "Deepest"],
    ["/Engineering/Backend/", "Backend"],
    ["", ""],
  ])("names %p as %p", (name, expected) => {
    expect(sharedFolderName({ name })).toBe(expected);
  });
});

describe("sharedFolderDisplayName", () => {
  const i18nService = { t: (key: string) => key } as I18nService;

  function collection(
    name: string,
    type: CollectionView["type"],
    defaultUserCollectionEmail?: string,
  ): CollectionView {
    return Object.assign(
      new CollectionView({
        id: "col1" as CollectionId,
        organizationId: "org1" as OrganizationId,
        name,
      }),
      { type, defaultUserCollectionEmail },
    );
  }

  it("names the member's own My items collection from i18n, whatever its stored name", () => {
    expect(
      sharedFolderDisplayName(
        collection("My Items", CollectionTypes.DefaultUserCollection),
        i18nService,
      ),
    ).toBe("myItemsV2");
  });

  it("keeps the email on another member's My items collection", () => {
    expect(
      sharedFolderDisplayName(
        collection("My Items", CollectionTypes.DefaultUserCollection, "member@example.com"),
        i18nService,
      ),
    ).toBe("member@example.com");
  });

  it("keeps a shared collection's stored name", () => {
    expect(
      sharedFolderDisplayName(
        collection("Engineering/Backend", CollectionTypes.SharedCollection),
        i18nService,
      ),
    ).toBe("Engineering/Backend");
  });
});
