import { Guid } from "../../types/guid";
import { Folder as FolderDomain } from "../../vault/models/domain/folder";
import { FolderView } from "../../vault/models/view/folder.view";

import { FolderExport } from "./folder.export";

export class FolderWithIdExport extends FolderExport {
  id: Guid;

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: FolderView | FolderDomain) {
    this.id = o.id;
    super.build(o);
  }
}
