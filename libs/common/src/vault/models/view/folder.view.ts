import { Jsonify } from "type-fest";

import { ITreeNodeObject } from "../../../models/domain/tree-node";
import { View } from "../../../models/view/view";
import { Guid } from "../../../types/guid";
import { Folder } from "../domain/folder";

export class FolderView implements View, ITreeNodeObject {
  id: Guid = null;
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
    const revisionDate = obj.revisionDate == null ? null : new Date(obj.revisionDate);
    return Object.assign(new FolderView(), obj, { revisionDate });
  }
}
