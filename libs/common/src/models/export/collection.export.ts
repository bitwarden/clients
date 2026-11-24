// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "@bitwarden/sdk-internal";

import {
  CollectionView,
  Collection as CollectionDomain,
} from "../../admin-console/models/collections";
import { CollectionId, emptyGuid, OrganizationId } from "../../types/guid";

export class CollectionExport {
  static template(): CollectionExport {
    const req = new CollectionExport();
    req.organizationId = emptyGuid as OrganizationId;
    req.name = "Collection name";
    // null (not undefined) so JSON.stringify emits the field in `bw get template` output
    req.externalId = null;
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
    domain.name = req.name != null ? (req.name as EncString) : null;
    domain.externalId = req.externalId;
    if (domain.organizationId == null) {
      domain.organizationId = req.organizationId;
    }
    return domain;
  }

  organizationId: OrganizationId;
  name: string;
  // Nullable (not just optional) so `template()` can emit `"externalId": null` — JSON.stringify omits undefined
  externalId: string | null | undefined;

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CollectionView | CollectionDomain) {
    this.organizationId = o.organizationId;
    this.name = o.name ?? undefined;
    this.externalId = o.externalId;
  }
}
