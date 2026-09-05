import { CollectionExport } from "@bitwarden/common/models/export/collection.export";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { SelectionReadOnly } from "../selection-read-only";

export class OrganizationCollectionRequest extends CollectionExport {
  static template(): OrganizationCollectionRequest {
    const req = new OrganizationCollectionRequest();
    req.organizationId = "00000000-0000-0000-0000-000000000000" as OrganizationId;
    req.name = "Collection name";
    req.groups = [SelectionReadOnly.template(), SelectionReadOnly.template()];
    req.users = [SelectionReadOnly.template(), SelectionReadOnly.template()];
    return req;
  }

  groups: SelectionReadOnly[] = [];
  users: SelectionReadOnly[] = [];
}
