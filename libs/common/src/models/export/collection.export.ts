// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Collection as CollectionDomain, CollectionView } from "@bitwarden/admin-console/common";

import { EncString } from "../../key-management/crypto/models/enc-string";
import { CollectionId, emptyGuid, OrganizationId } from "../../types/guid";

import { safeGetString } from "./utils";

export class CollectionExport {
  constructor() {
    this.organizationId = emptyGuid as OrganizationId;
    this.name = "";
    this.externalId = "";
  }

  static template(): CollectionExport {
    const req = new CollectionExport();
    req.organizationId = emptyGuid as OrganizationId;
    req.name = "Collection name";
    req.externalId = "";
    return req;
  }

  static toView(req: CollectionExport, id: CollectionId) {
    const view = new CollectionView({
      name: req.name,
      organizationId: req.organizationId,
      id,
    });
    view.externalId = req.externalId;
    return view;
  }

  static toDomain(req: CollectionExport, domain: CollectionDomain) {
    domain.name = new EncString(req.name);
    domain.externalId = req.externalId;
    if (domain.organizationId == null) {
      domain.organizationId = req.organizationId;
    }
    return domain;
  }

  organizationId: OrganizationId;
  name: string;
  externalId?: string;

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CollectionView | CollectionDomain) {
    this.organizationId = o.organizationId;
    this.name = safeGetString(o.name) ?? "";
    this.externalId = o.externalId;
  }
}
