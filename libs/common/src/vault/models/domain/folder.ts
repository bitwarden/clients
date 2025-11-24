import { Jsonify } from "type-fest";

import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { FolderData } from "../data/folder.data";
import { FolderView } from "../view/folder.view";

export class Folder extends Domain {
  id: string = "";
  name: EncString = new EncString("");
  revisionDate: Date = new Date();

  constructor(obj?: FolderData) {
    super();
    if (obj == null) {
      return;
    }

    this.id = obj.id;
    this.name = new EncString(obj.name);
    this.revisionDate = new Date(obj.revisionDate);
  }

  decrypt(): Promise<FolderView> {
    return this.decryptObj<Folder, FolderView>(this, new FolderView(this), ["name"], null);
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
    folder.name = EncString.fromJSON(obj.name);
    folder.revisionDate = new Date(obj.revisionDate);
    return folder;
  }
}
