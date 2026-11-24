import { Jsonify } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { EncryptService, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { FolderData } from "../data/folder.data";
import { FolderView } from "../view/folder.view";

export class Folder extends Domain {
  id: string = "";
  name: EncString = "" as EncString;
  revisionDate: Date = new Date();

  constructor(obj?: FolderData) {
    super();
    if (obj == null) {
      return;
    }

    this.id = obj.id;
    this.name = obj.name as EncString;
    this.revisionDate = new Date(obj.revisionDate);
  }

  decrypt(key: SymmetricCryptoKey): Promise<FolderView> {
    return this.decryptObj<Folder, FolderView>(this, new FolderView(this), ["name"], key);
  }

  async decryptWithKey(
    key: SymmetricCryptoKey,
    encryptService: EncryptService,
  ): Promise<FolderView> {
    const folderView = new FolderView();
    folderView.id = this.id;
    folderView.revisionDate = this.revisionDate;
    try {
      folderView.name = await encryptService.decryptString(this.name, key);
    } catch (e) {
      // Note: This should be replaced by the owning team with appropriate, domain-specific behavior.
      // eslint-disable-next-line no-console
      console.error("[Folder] Error decrypting folder", e);
      throw e;
    }
    return folderView;
  }

  static fromJSON(obj: Jsonify<Folder>) {
    if (obj == null) {
      return null;
    }

    const folder = new Folder();
    folder.id = obj.id;
    folder.name = obj.name ?? null;
    folder.revisionDate = new Date(obj.revisionDate);
    return folder;
  }
}
