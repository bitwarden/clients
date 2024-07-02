import { Jsonify } from "type-fest";

import { View } from "../../../models/view/view";
import { Folder } from "../domain/folder";
import { ITreeNodeObject } from "../domain/tree-node";

export class FolderView implements View, ITreeNodeObject {
  id: string = null;
  name: string = null;
  revisionDate: Date = null;

  constructor(f?: Folder) {
    if (!f) {
      return;
    }

    this.id = f.id;
    this.revisionDate = f.revisionDate;
  }

  static fromJSON(obj: Jsonify<FolderView>) {
    if (obj == null) {
      return null;
    }

    const revisionDate = obj?.revisionDate == null ? null : new Date(obj.revisionDate);
    return Object.assign(new FolderView(), obj, { revisionDate });
  }
}
