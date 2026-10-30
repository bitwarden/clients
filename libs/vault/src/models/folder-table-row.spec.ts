import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { buildFolderRows } from "./folder-table-row";

const folder = (id: string, name: string): FolderView =>
  Object.assign(new FolderView(), { id, name });

let nextCipherId = 0;
const cipher = (folderId: string | undefined, overrides: Partial<CipherView> = {}): CipherView =>
  Object.assign(new CipherView(), { id: `cipher-${nextCipherId++}`, folderId }, overrides);

describe("buildFolderRows", () => {
  it("counts the ciphers each folder is applied to", () => {
    const rows = buildFolderRows(
      [folder("1", "Banking"), folder("2", "Travel")],
      [cipher("1"), cipher("1"), cipher("2"), cipher(undefined)],
    );

    expect(rows).toEqual([
      { id: "1", name: "Banking", displayName: "Banking", itemCount: 2, nestedFolders: 0 },
      { id: "2", name: "Travel", displayName: "Travel", itemCount: 1, nestedFolders: 0 },
    ]);
  });

  it("excludes trashed ciphers from the count but keeps archived ones", () => {
    const rows = buildFolderRows(
      [folder("1", "Banking")],
      [
        cipher("1"),
        cipher("1", { deletedDate: new Date() }),
        cipher("1", { archivedDate: new Date() }),
      ],
    );

    expect(rows[0].itemCount).toBe(2);
  });

  it("excludes the synthetic no-folder entry", () => {
    const rows = buildFolderRows([folder("1", "Banking"), new FolderView()], []);

    expect(rows.map((row) => row.id)).toEqual(["1"]);
  });

  it("shows an em-dash when the folder has no name", () => {
    const rows = buildFolderRows([folder("1", "   ")], []);

    expect(rows[0].displayName).toBe("—");
  });

  it("keeps a folder whose name is empty as a row of its own", () => {
    const rows = buildFolderRows([folder("1", ""), folder("2", "Banking")], [cipher("1")]);

    expect(rows).toEqual([
      { id: "2", name: "Banking", displayName: "Banking", itemCount: 0, nestedFolders: 0 },
      { id: "1", name: "", displayName: "—", itemCount: 1, nestedFolders: 0 },
    ]);
  });

  describe("nesting", () => {
    it("lists only top-level folders, named by their own segment", () => {
      const rows = buildFolderRows(
        [folder("1", "Family"), folder("2", "Family/Kids"), folder("3", "Work")],
        [],
      );

      expect(rows.map((row) => [row.id, row.name, row.displayName])).toEqual([
        ["1", "Family", "Family"],
        ["3", "Work", "Work"],
      ]);
    });

    it("counts the folders directly inside a parent, not those further down", () => {
      const rows = buildFolderRows(
        [
          folder("1", "Family"),
          folder("2", "Family/Kids"),
          folder("3", "Family/Pets"),
          folder("4", "Family/Kids/Toys"),
        ],
        [],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].nestedFolders).toBe(2);
    });

    it("totals the items of the whole tree under a top-level folder", () => {
      const rows = buildFolderRows(
        [
          folder("1", "Family"),
          folder("2", "Family/Kids"),
          folder("3", "Family/Kids/Toys"),
          folder("4", "Work"),
        ],
        [cipher("1"), cipher("2"), cipher("2"), cipher("3"), cipher("4")],
      );

      expect(rows.map((row) => [row.id, row.itemCount])).toEqual([
        ["1", 4],
        ["4", 1],
      ]);
    });

    it("leaves trashed ciphers out of a tree's total", () => {
      const rows = buildFolderRows(
        [folder("1", "Family"), folder("2", "Family/Kids")],
        [cipher("2"), cipher("2", { deletedDate: new Date() })],
      );

      expect(rows[0].itemCount).toBe(1);
    });

    it("lists a folder whose parent does not exist at the top level", () => {
      const rows = buildFolderRows([folder("1", "Family/Kids"), folder("2", "Work")], []);

      expect(rows.map((row) => [row.id, row.displayName])).toEqual([
        ["1", "Family/Kids"],
        ["2", "Work"],
      ]);
    });
  });
});
