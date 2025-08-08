// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Collection as CollectionDomain, CollectionView } from "@bitwarden/admin-console/common";

import { CollectionId } from "../../types/guid";

import { CollectionExport } from "./collection.export";

export class CollectionWithIdExport extends CollectionExport {
  id: CollectionId;

  static toView(req: CollectionWithIdExport, view = new CollectionView()) {
    view.id = req.id;
    return super.toView(req, view);
  }

  static toDomain(req: CollectionWithIdExport, domain = new CollectionDomain()) {
    domain.id = req.id;
    return super.toDomain(req, domain);
  }

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CollectionView | CollectionDomain) {
    this.id = o.id;
    super.build(o);
  }
}
