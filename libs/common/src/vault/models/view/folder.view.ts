// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { FolderView as SdkFolderView } from "@bitwarden/sdk-internal";

import { View } from "../../../models/view/view";
import { DecryptedObject } from "../../../platform/models/domain/domain-base";
import { Folder } from "../domain/folder";
import { ITreeNodeObject } from "../domain/tree-node";

export class FolderView implements View, ITreeNodeObject {
  id: string = null;
  name: string = null;
  revisionDate: Date = null;

  constructor(f?: Folder | DecryptedObject<Folder, "name">) {
    if (!f) {
      return;
    }

    this.id = f.id;
    this.revisionDate = f.revisionDate;
  }

  static fromJSON(obj: Jsonify<FolderView>) {
    const revisionDate = obj.revisionDate == null ? null : new Date(obj.revisionDate);
    return Object.assign(new FolderView(), obj, { revisionDate });
  }

  static fromSdk(sdkFolder: SdkFolderView): FolderView {
    const folder = new FolderView();
    folder.id = sdkFolder.id;
    folder.name = sdkFolder.name;
    folder.revisionDate = sdkFolder.revisionDate ? new Date(sdkFolder.revisionDate) : null;
    return folder;
  }
}
