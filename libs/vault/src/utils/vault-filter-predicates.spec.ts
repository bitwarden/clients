import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  matchesFolder,
  matchesMyItems,
  matchesSharedFolder,
  NO_FOLDER,
} from "./vault-filter-predicates";

const buildCipher = ({
  collectionIds = [],
  folderId,
}: {
  collectionIds?: string[];
  folderId?: string;
}) => {
  const cipher = new CipherView();
  cipher.collectionIds = collectionIds;
  cipher.folderId = folderId;
  return cipher;
};

describe("matchesSharedFolder", () => {
  it.each<[string[] | undefined]>([[undefined], [[]]])(
    "matches everything for an unfiltered selection (%p)",
    (selection) => {
      expect(matchesSharedFolder(buildCipher({}), selection)).toBe(true);
    },
  );

  it("matches a cipher in any selected collection", () => {
    const selection = ["col1", "col2"];

    expect(matchesSharedFolder(buildCipher({ collectionIds: ["col3", "col2"] }), selection)).toBe(
      true,
    );
    expect(matchesSharedFolder(buildCipher({ collectionIds: ["col3"] }), selection)).toBe(false);
    expect(matchesSharedFolder(buildCipher({}), selection)).toBe(false);
  });

  it("matches each row against the same selection array", () => {
    const selection = ["col1"];
    const inSelection = buildCipher({ collectionIds: ["col1"] });
    const outOfSelection = buildCipher({ collectionIds: ["col2"] });

    expect(matchesSharedFolder(inSelection, selection)).toBe(true);
    expect(matchesSharedFolder(outOfSelection, selection)).toBe(false);
    expect(matchesSharedFolder(inSelection, selection)).toBe(true);
  });

  it("follows a new selection array rather than the previous one", () => {
    const cipher = buildCipher({ collectionIds: ["col1"] });

    expect(matchesSharedFolder(cipher, ["col1"])).toBe(true);
    expect(matchesSharedFolder(cipher, ["col2"])).toBe(false);
  });
});

describe("matchesFolder", () => {
  it.each<[string[] | undefined]>([[undefined], [[]]])(
    "matches everything for an unfiltered selection (%p)",
    (selection) => {
      expect(matchesFolder(buildCipher({ folderId: "folder1" }), selection)).toBe(true);
    },
  );

  it("matches a cipher in any selected folder", () => {
    const selection = ["folder1", "folder2"];

    expect(matchesFolder(buildCipher({ folderId: "folder2" }), selection)).toBe(true);
    expect(matchesFolder(buildCipher({ folderId: "folder3" }), selection)).toBe(false);
  });

  it("matches a cipher with no folder only when no folder is selected", () => {
    const cipher = buildCipher({});

    expect(matchesFolder(cipher, [NO_FOLDER])).toBe(true);
    expect(matchesFolder(cipher, ["folder1"])).toBe(false);
    expect(matchesFolder(buildCipher({ folderId: "folder1" }), [NO_FOLDER])).toBe(false);
  });
});

describe("matchesMyItems", () => {
  const inMyItems = buildCipher({ collectionIds: ["other", "myItems"] });
  const notInMyItems = buildCipher({ collectionIds: ["other"] });

  it("matches only ciphers in the My items collection when filtered", () => {
    expect(matchesMyItems(inMyItems, true, "myItems")).toBe(true);
    expect(matchesMyItems(notInMyItems, true, "myItems")).toBe(false);
    expect(matchesMyItems(buildCipher({}), true, "myItems")).toBe(false);
  });

  it.each([
    [false, "myItems"],
    [undefined, "myItems"],
    [true, undefined],
  ])("matches everything when myItems is %p and the collection id is %p", (myItems, id) => {
    expect(matchesMyItems(notInMyItems, myItems, id)).toBe(true);
  });
});
