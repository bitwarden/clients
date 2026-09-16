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
      { id: "1", name: "Banking", displayName: "Banking", itemCount: 2 },
      { id: "2", name: "Travel", displayName: "Travel", itemCount: 1 },
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
});
