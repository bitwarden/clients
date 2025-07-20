// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { FolderResponse } from "../response/folder.response";

export class FolderData {
  id: string;
  name: string;
  revisionDate: string;

  constructor(response: Partial<FolderResponse>) {
    this.name = response?.name;
    this.id = response?.id;
    this.revisionDate = response?.revisionDate;
  }

  static fromJSON(obj: Jsonify<FolderData>) {
    return Object.assign(new FolderData({}), obj);
  }
}
