// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Collection as CollectionDomain, CollectionView } from "@bitwarden/admin-console/common";

import { EncString } from "../../key-management/crypto/models/enc-string";
import { emptyGuid, OrganizationId } from "../../types/guid";

import { safeGetString } from "./utils";

export class CollectionExport {
  static template(): CollectionExport {
    const req = new CollectionExport();
    req.organizationId = emptyGuid as OrganizationId;
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

  organizationId: OrganizationId;
  name: string;
  externalId: string;

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CollectionView | CollectionDomain) {
    this.organizationId = o.organizationId;
    this.name = safeGetString(o.name);
    this.externalId = o.externalId;
  }
}
