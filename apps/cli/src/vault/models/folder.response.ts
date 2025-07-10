import { FolderWithIdExport } from "@bitwarden/common/models/export";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { BaseResponse } from "../../models/response/base.response";

export class FolderResponse extends FolderWithIdExport implements BaseResponse {
  object: string;

  constructor(o: FolderView) {
    super();
    this.object = "folder";
    this.build(o);
  }
}
