import { Jsonify } from "type-fest";

import { FolderResponse } from "../response/folder.response";

export class FolderData {
  id: string;
  name: string;
  revisionDate: string;

  constructor(response: Partial<FolderResponse>) {
    this.name = response.name ?? "";
    this.id = response.id ?? "";
    this.revisionDate = response.revisionDate ?? "";
  }

  static fromJSON(obj: Jsonify<FolderData | null>) {
    if (obj == null) {
      return null;
    }
    return new FolderData({
      id: obj.id,
      name: obj.name,
      revisionDate: obj.revisionDate,
    });
  }
}
