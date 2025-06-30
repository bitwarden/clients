// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Folder as SdkFolder } from "@bitwarden/sdk-internal";

import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import Domain from "../../../platform/models/domain/domain-base";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { SdkRecordMapper } from "../../../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../../../platform/state";
import { FOLDER_ENCRYPTED_FOLDERS } from "../../services/key-state/folder.state";
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

  static fromSdk(obj: SdkFolder): Folder {
    const folder = new Folder();
    folder.id = obj.id;
    folder.name = new EncString(obj.name);
    folder.revisionDate = obj.revisionDate ? new Date(obj.revisionDate) : null;
    return folder;
  }

  toSdkFolder(): SdkFolder {
    return {
      id: this.id,
      name: this.name.toString(),
      revisionDate: this.revisionDate ? this.revisionDate.toISOString() : null,
    };
  }
}

export class FolderRecordMapper implements SdkRecordMapper<FolderData, SdkFolder> {
  userKeyDefinition(): UserKeyDefinition<Record<string, FolderData>> {
    return FOLDER_ENCRYPTED_FOLDERS;
  }

  toSdk(value: FolderData): SdkFolder {
    return new Folder(value).toSdkFolder();
  }

  fromSdk(value: SdkFolder): FolderData {
    return FolderData.fromSdk(value);
  }
}
