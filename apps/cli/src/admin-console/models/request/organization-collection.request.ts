// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionExport } from "@bitwarden/common/models/export/collection.export";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { SelectionReadOnly } from "../selection-read-only";

export class OrganizationCollectionRequest extends CollectionExport {
  static template(): OrganizationCollectionRequest {
    const req = new OrganizationCollectionRequest();
    req.organizationId = "00000000-0000-0000-0000-000000000000" as OrganizationId;
    req.name = "Collection name";
    req.externalId = null;
    req.groups = [SelectionReadOnly.template(), SelectionReadOnly.template()];
    req.users = [SelectionReadOnly.template(), SelectionReadOnly.template()];
    return req;
  }

  groups: SelectionReadOnly[];
  users: SelectionReadOnly[];
}
