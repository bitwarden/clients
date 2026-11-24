import { EncString } from "@bitwarden/sdk-internal";

import { Folder as FolderDomain } from "../../vault/models/domain/folder";
import { FolderView } from "../../vault/models/view/folder.view";

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
    domain.name = req.name as EncString;
    return domain;
  }

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: FolderView | FolderDomain) {
    this.name = o.name ?? "";
  }
}
