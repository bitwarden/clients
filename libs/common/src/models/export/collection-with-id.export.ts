// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  CollectionView,
  Collection as CollectionDomain,
} from "@bitwarden/common/admin-console/models/collections";
import { CollectionId } from "@bitwarden/common/types/guid";

import { CollectionExport } from "./collection.export";

export class CollectionWithIdExport extends CollectionExport {
  id: CollectionId;

  static toView(req: CollectionWithIdExport) {
    return super.toView(req, req.id);
  }

  static toDomain(req: CollectionWithIdExport, domain: CollectionDomain) {
    domain.id = req.id;
    return super.toDomain(req, domain);
  }

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CollectionView | CollectionDomain) {
    this.id = o.id;
    super.build(o);
  }
}
