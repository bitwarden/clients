import { EncString } from "../../key-management/crypto/models/enc-string";
import { Folder as FolderDomain } from "../../vault/models/domain/folder";
import { FolderView } from "../../vault/models/view/folder.view";

import { safeGetString } from "./utils";

export class FolderExport {
  name: string = "";

  static template(): FolderExport {
    const req = new FolderExport();
    req.name = "Folder name";
    return req;
  }

  static toView(req: FolderExport, view = new FolderView()) {
    view.name = req.name;
    return view;
  }

  static toDomain(req: FolderExport, domain = new FolderDomain()) {
    domain.name = new EncString(req.name);
    return domain;
  }

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: FolderView | FolderDomain) {
    this.name = safeGetString(o.name) ?? "";
  }
}
