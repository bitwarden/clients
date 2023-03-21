import { EMPTY_GUID, Guid } from "../../types/guid";
import { Collection as CollectionDomain } from "../domain/collection";
import { EncString } from "../domain/enc-string";
import { CollectionView } from "../view/collection.view";

export class CollectionExport {
  static template(): CollectionExport {
    const req = new CollectionExport();
    req.organizationId = EMPTY_GUID;
    req.name = "Collection name";
    req.externalId = null;
    return req;
  }

  static toView(req: CollectionExport, view = new CollectionView()) {
    view.name = req.name;
    view.externalId = req.externalId;
    if (view.organizationId == null) {
      view.organizationId = req.organizationId;
    }
    return view;
  }

  static toDomain(req: CollectionExport, domain = new CollectionDomain()) {
    domain.name = req.name != null ? new EncString(req.name) : null;
    domain.externalId = req.externalId;
    if (domain.organizationId == null) {
      domain.organizationId = req.organizationId;
    }
    return domain;
  }

  organizationId: Guid;
  name: string;
  externalId: string;

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CollectionView | CollectionDomain) {
    this.organizationId = o.organizationId;
    if (o instanceof CollectionView) {
      this.name = o.name;
    } else {
      this.name = o.name?.encryptedString;
    }
    this.externalId = o.externalId;
  }
}
