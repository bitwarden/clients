import { Jsonify } from "type-fest";

import { View } from "../../../models/view/view";
import { DecryptedObject } from "../../../platform/models/domain/domain-base";
import { Folder } from "../domain/folder";
import { ITreeNodeObject } from "../domain/tree-node";

export class FolderView implements View, ITreeNodeObject {
  id: string = "";
  name: string = "";
  revisionDate: Date;

  constructor(f?: Folder | DecryptedObject<Folder, "name">) {
    if (!f) {
      this.revisionDate = new Date();
      return;
    }

    this.id = f.id;
    this.revisionDate = f.revisionDate;
  }

  static fromJSON(obj: Jsonify<FolderView>) {
    const folderView = new FolderView();
    folderView.id = obj.id;
    folderView.name = obj.name;
    folderView.revisionDate = new Date(obj.revisionDate);
    return folderView;
  }
}
