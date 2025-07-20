// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { FolderData } from "../data/folder.data";
import { FolderView } from "../view/folder.view";

export class Test extends Domain {
  id: string;
  name: EncString;
  revisionDate: Date;
}

export class Folder extends Domain {
  id: string;
  name: EncString;
  revisionDate: Date;

  constructor(obj?: FolderData) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        name: null,
      },
      ["id"],
    );

    this.revisionDate = obj.revisionDate != null ? new Date(obj.revisionDate) : null;
  }

  decrypt(): Promise<FolderView> {
    return this.decryptObj<Folder, FolderView>(this, new FolderView(this), ["name"], null);
  }

  async decryptWithKey(
    key: SymmetricCryptoKey,
    encryptService: EncryptService,
  ): Promise<FolderView> {
    const decrypted = await this.decryptObjWithKey(["name"], key, encryptService, Folder);

    const view = new FolderView(decrypted);
    view.name = decrypted.name;
    return view;
  }

  static fromJSON(obj: Jsonify<Folder>) {
    const revisionDate = obj.revisionDate == null ? null : new Date(obj.revisionDate);
    return Object.assign(new Folder(), obj, { name: EncString.fromJSON(obj.name), revisionDate });
  }
}
