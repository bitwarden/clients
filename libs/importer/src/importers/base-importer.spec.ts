import { CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportResult } from "../models";

import { BaseImporter } from "./base-importer";

class FakeBaseImporter extends BaseImporter {
  initLoginCipher(): CipherView {
    return super.initLoginCipher();
  }

  setCardExpiration(cipher: CipherView, expiration: string): boolean {
    return super.setCardExpiration(cipher, expiration);
  }

  parseXml(data: string): Document {
    return super.parseXml(data);
  }

  processFolder(result: ImportResult, folderName: string, addRelationship: boolean = true): void {
    return super.processFolder(result, folderName, addRelationship);
  }

  cleanupCipher(cipher: CipherView): void {
    return super.cleanupCipher(cipher);
  }
}

describe("processFolder method", () => {
  let result: ImportResult;
  const importer = new FakeBaseImporter();

  beforeEach(() => {
    result = {
      folders: [],
      folderRelationships: [],
      collections: [],
      collectionRelationships: [],
      ciphers: [],
      success: false,
      errorMessage: "",
    };
  });

  it("should add a new folder and relationship when folderName is unique", () => {
    // arrange
    // a folder exists - but it is not the same as the one we are importing
    result = {
      folders: [{ name: "ABC" } as FolderView],
      folderRelationships: [],
      collections: [],
      collectionRelationships: [],
      ciphers: [{ name: "cipher1", id: "cipher1" } as CipherView],
      success: false,
      errorMessage: "",
    };
    importer.processFolder(result, "Folder1");

    expect(result.folders).toHaveLength(2);
    expect(result.folders[0].name).toBe("ABC");
    expect(result.folders[1].name).toBe("Folder1");
    expect(result.folderRelationships).toHaveLength(1);
    expect(result.folderRelationships[0]).toEqual([1, 1]); // cipher1 -> Folder1
  });

  it("should not add duplicate folders and should add relationships", () => {
    // setup
    // folder called "Folder1" already exists
    result = {
      folders: [{ name: "Folder1" } as FolderView],
      folderRelationships: [],
      collections: [],
      collectionRelationships: [],
      ciphers: [{ name: "cipher1", id: "cipher1" } as CipherView],
      success: false,
      errorMessage: "",
    };

    // import an existing folder should not add to the result.folders
    importer.processFolder(result, "Folder1");

    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe("Folder1");
    expect(result.folderRelationships).toHaveLength(1);
    expect(result.folderRelationships[0]).toEqual([1, 0]); // cipher1 -> folder1
  });

  it("should create parent folders for nested folder names but not duplicates", () => {
    // arrange
    result = {
      folders: [
        { name: "Ancestor/Parent/Child" } as FolderView,
        { name: "Ancestor" } as FolderView,
      ],
      folderRelationships: [],
      collections: [],
      collectionRelationships: [],
      ciphers: [{ name: "cipher1", id: "cipher1" } as CipherView],
      success: false,
      errorMessage: "",
    };

    // act
    // importing an existing folder with a relationship should not change the result.folders
    // nor should it change the result.folderRelationships
    importer.processFolder(result, "Ancestor/Parent/Child/Grandchild/GreatGrandchild");

    expect(result.folders).toHaveLength(5);
    expect(result.folders.map((f) => f.name)).toEqual([
      "Ancestor/Parent/Child",
      "Ancestor",
      "Ancestor/Parent/Child/Grandchild/GreatGrandchild",
      "Ancestor/Parent/Child/Grandchild",
      "Ancestor/Parent",
    ]);
    expect(result.folderRelationships).toHaveLength(1);
    expect(result.folderRelationships[0]).toEqual([1, 2]); // cipher1 -> grandchild
  });

  it("should not affect existing relationships", () => {
    // arrange
    // "Parent" is a folder with no relationship
    // "Child" is a folder with 2 ciphers
    result = {
      folders: [{ name: "Parent" } as FolderView, { name: "Parent/Child" } as FolderView],
      folderRelationships: [
        [1, 1],
        [2, 1],
      ],
      collections: [],
      collectionRelationships: [],
      ciphers: [
        { name: "cipher1", id: "cipher1" } as CipherView,
        { name: "cipher2", id: "cipher2" } as CipherView,
        { name: "cipher3", id: "cipher3" } as CipherView,
      ],
      success: false,
      errorMessage: "",
    };

    // act
    // importing an existing folder with a relationship should not change the result.folders
    // nor should it change the result.folderRelationships
    importer.processFolder(result, "Parent/Child/Grandchild");

    expect(result.folders).toHaveLength(3);
    expect(result.folders.map((f) => f.name)).toEqual([
      "Parent",
      "Parent/Child",
      "Parent/Child/Grandchild",
    ]);
    expect(result.folderRelationships).toHaveLength(3);
    expect(result.folderRelationships[0]).toEqual([1, 1]); // cipher1 -> child
    expect(result.folderRelationships[1]).toEqual([2, 1]); // cipher2 -> child
    expect(result.folderRelationships[2]).toEqual([3, 2]); // cipher3 -> grandchild
  });

  it("should not add relationships if addRelationship is false", () => {
    importer.processFolder(result, "Folder1", false);

    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe("Folder1");
    expect(result.folderRelationships).toHaveLength(0);
  });

  it("should replace backslashes with forward slashes in folder names", () => {
    importer.processFolder(result, "Parent\\Child\\Grandchild");

    expect(result.folders).toHaveLength(3);
    expect(result.folders.map((f) => f.name)).toEqual([
      "Parent/Child/Grandchild",
      "Parent/Child",
      "Parent",
    ]);
  });

  it("should handle empty or null folder names gracefully", () => {
    importer.processFolder(result, null);
    importer.processFolder(result, "");

    expect(result.folders).toHaveLength(0);
    expect(result.folderRelationships).toHaveLength(0);
  });
});

describe("BaseImporter class", () => {
  const importer = new FakeBaseImporter();
  let cipher: CipherView;

  describe("setCardExpiration method", () => {
    beforeEach(() => {
      cipher = importer.initLoginCipher();
      cipher.card = new CardView();
      cipher.type = CipherType.Card;
    });

    it.each([
      ["01/2025", "1", "2025"],
      ["5/21", "5", "2021"],
      ["10/2100", "10", "2100"],
    ])(
      "sets ciper card expYear & expMonth and returns true",
      (expiration, expectedMonth, expectedYear) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(cipher.card.expMonth).toBe(expectedMonth);
        expect(cipher.card.expYear).toBe(expectedYear);
        expect(result).toBe(true);
      },
    );

    it.each([
      ["01/2032", "1"],
      ["09/2032", "9"],
      ["10/2032", "10"],
    ])("removes leading zero from month", (expiration, expectedMonth) => {
      const result = importer.setCardExpiration(cipher, expiration);
      expect(cipher.card.expMonth).toBe(expectedMonth);
      expect(cipher.card.expYear).toBe("2032");
      expect(result).toBe(true);
    });

    it.each([
      ["12/00", "2000"],
      ["12/99", "2099"],
      ["12/32", "2032"],
      ["12/2042", "2042"],
    ])("prefixes '20' to year if only two digits long", (expiration, expectedYear) => {
      const result = importer.setCardExpiration(cipher, expiration);
      expect(cipher.card.expYear).toHaveLength(4);
      expect(cipher.card.expYear).toBe(expectedYear);
      expect(result).toBe(true);
    });

    it.each([["01 / 2025"], ["01  /  2025"], ["  01/2025  "], [" 01/2025 "]])(
      "removes any whitespace in expiration string",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(cipher.card.expMonth).toBe("1");
        expect(cipher.card.expYear).toBe("2025");
        expect(result).toBe(true);
      },
    );

    it.each([[""], ["  "], [null]])(
      "returns false if expiration is null or empty ",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(result).toBe(false);
      },
    );

    it.each([["0123"], ["01/03/23"]])(
      "returns false if invalid card expiration string",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(result).toBe(false);
      },
    );

    it.each([["5/"], ["03/231"], ["12/1"], ["2/20221"]])(
      "returns false if year is not 2 or 4 digits long",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(result).toBe(false);
      },
    );

    it.each([["/2023"], ["003/2023"], ["111/32"]])(
      "returns false if month is not 1 or 2 digits long",
      (expiration) => {
        const result = importer.setCardExpiration(cipher, expiration);
        expect(result).toBe(false);
      },
    );

    it("parse XML should reject xml with external entities", async () => {
      const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
        <!DOCTYPE replace [
        <!ELEMENT replace ANY>
        <!ENTITY xxe "External entity">
        ]>
        <passwordsafe delimiter=";">
        <entry><title>PoC XXE</title><username>&xxe;</username></entry>
        </passwordsafe>`;
      const result = importer.parseXml(xml);
      expect(result).toBe(null);
    });
  });

  describe("cleanupCipher method", () => {
    beforeEach(() => {
      cipher = importer.initLoginCipher();
    });

    it("should preserve leading and trailing spaces in notes", () => {
      cipher.notes = "  This note has leading and trailing spaces  ";
      importer.cleanupCipher(cipher);
      expect(cipher.notes).toBe("  This note has leading and trailing spaces  ");
    });

    it("should preserve spaces in the middle of notes", () => {
      cipher.notes = "This note has   multiple   spaces";
      importer.cleanupCipher(cipher);
      expect(cipher.notes).toBe("This note has   multiple   spaces");
    });

    it("should set notes to null if they contain only whitespace", () => {
      cipher.notes = "   \t\n  ";
      importer.cleanupCipher(cipher);
      expect(cipher.notes).toBe(null);
    });

    it("should set notes to null if they are empty", () => {
      cipher.notes = "";
      importer.cleanupCipher(cipher);
      expect(cipher.notes).toBe(null);
    });

    it("should set notes to null if they are null", () => {
      cipher.notes = null;
      importer.cleanupCipher(cipher);
      expect(cipher.notes).toBe(null);
    });

    it("should preserve normal notes without spaces", () => {
      cipher.notes = "This is a normal note";
      importer.cleanupCipher(cipher);
      expect(cipher.notes).toBe("This is a normal note");
    });

    it("should set name to '--' if it contains only whitespace", () => {
      cipher.name = "   \t\n  ";
      importer.cleanupCipher(cipher);
      expect(cipher.name).toBe("--");
    });

    it("should preserve normal names", () => {
      cipher.name = "Test Item";
      importer.cleanupCipher(cipher);
      expect(cipher.name).toBe("Test Item");
    });
  });
});
