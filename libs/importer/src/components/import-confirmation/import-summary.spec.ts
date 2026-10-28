import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportResult } from "../../models";

import { summarizeImport } from "./import-summary";

function cipher(type: CipherType): CipherView {
  const view = new CipherView();
  view.type = type;
  return view;
}

describe("summarizeImport", () => {
  it("counts client-side ciphers by type in display order", () => {
    const result = new ImportResult();
    result.ciphers = [
      cipher(CipherType.Card),
      cipher(CipherType.Login),
      cipher(CipherType.Login),
      cipher(CipherType.SshKey),
    ];

    expect(summarizeImport({ kind: "imported", result })).toEqual({
      total: 4,
      rows: [
        { icon: "globe", labelKey: "typeLogin", count: 2 },
        { icon: "credit-card", labelKey: "typeCard", count: 1 },
        { icon: "key", labelKey: "typeSshKey", count: 1 },
      ],
    });
  });

  it("leaves the target folder out of the folder count", () => {
    const result = new ImportResult();
    result.ciphers = [cipher(CipherType.Login)];
    result.folders = [new FolderView(), new FolderView(), new FolderView()];
    result.targetFolderIncluded = true;

    expect(summarizeImport({ kind: "imported", result }).rows).toContainEqual({
      icon: "folder",
      labelKey: "folders",
      count: 2,
    });
  });

  it("omits folder and collection rows when only the target was created", () => {
    const result = new ImportResult();
    result.ciphers = [cipher(CipherType.Login)];
    result.folders = [new FolderView()];
    result.targetFolderIncluded = true;

    expect(summarizeImport({ kind: "imported", result }).rows).toEqual([
      { icon: "globe", labelKey: "typeLogin", count: 1 },
    ]);
  });

  it("sums SDK counts that repeat a type and adds folders and collections", () => {
    const summary = summarizeImport({
      kind: "importedWithSdk",
      sdkSummary: {
        ciphers: [
          { type: CipherType.Login, count: 3 },
          { type: CipherType.Login, count: 2 },
          { type: CipherType.Identity, count: 1 },
        ],
        folders: 2,
        collections: 4,
      },
    });

    expect(summary).toEqual({
      total: 6,
      rows: [
        { icon: "globe", labelKey: "typeLogin", count: 5 },
        { icon: "id-card", labelKey: "typeIdentity", count: 1 },
        { icon: "folder", labelKey: "folders", count: 2 },
        { icon: "collection", labelKey: "collections", count: 4 },
      ],
    });
  });

  it("counts a cipher type with no row toward the total", () => {
    const summary = summarizeImport({
      kind: "importedWithSdk",
      sdkSummary: { ciphers: [{ type: 999, count: 2 }], folders: 0, collections: 0 },
    });

    expect(summary).toEqual({ total: 2, rows: [] });
  });
});
