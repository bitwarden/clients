// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionView } from "@bitwarden/admin-console/common";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { BrowserComponentState } from "./browserComponentState";

export class BrowserGroupingsComponentState extends BrowserComponentState {
  favoriteCiphers: CipherView[];
  noFolderCiphers: CipherView[];
  ciphers: CipherView[];
  collectionCounts: Map<string, number>;
  folderCounts: Map<string, number>;
  typeCounts: Map<CipherType, number>;
  folders: FolderView[];
  collections: CollectionView[];
  deletedCount: number;

  toJSON() {
    return Utils.merge(this, {
      collectionCounts: Utils.mapToRecord(this.collectionCounts),
      folderCounts: Utils.mapToRecord(this.folderCounts),
      typeCounts: Utils.mapToRecord(this.typeCounts),
    });
  }

  static fromJSON(json: DeepJsonify<BrowserGroupingsComponentState>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new BrowserGroupingsComponentState(), json, {
      favoriteCiphers: json.favoriteCiphers?.map((c) => CipherView.fromJSON(c)),
      noFolderCiphers: json.noFolderCiphers?.map((c) => CipherView.fromJSON(c)),
      ciphers: json.ciphers?.map((c) => CipherView.fromJSON(c)),
      collectionCounts: Utils.recordToMap(json.collectionCounts),
      folderCounts: Utils.recordToMap(json.folderCounts),
      typeCounts: Utils.recordToMap(json.typeCounts),
      folders: json.folders?.map((f) => FolderView.fromJSON(f)),
    });
  }
}
