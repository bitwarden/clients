// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Folder as SdkFolder } from "@bitwarden/sdk-internal";

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

  static fromSdk(obj: SdkFolder): FolderData {
    return new FolderData({
      id: obj.id,
      name: obj.name,
      revisionDate: obj.revisionDate,
    });
  }
}
