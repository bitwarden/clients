// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Folder as FolderDomain } from "../../vault/models/domain/folder";
import { FolderView } from "../../vault/models/view/folder.view";

import { FolderExport } from "./folder.export";

export class FolderWithIdExport extends FolderExport {
  id: string;

  static toView(req: FolderWithIdExport, view = new FolderView()) {
    view.id = req.id;
    return super.toView(req, view);
  }

  static toDomain(req: FolderWithIdExport, domain = new FolderDomain()) {
    domain.id = req.id;
    return super.toDomain(req, domain);
  }

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: FolderView | FolderDomain) {
    this.id = o.id;
    super.build(o);
  }
}
