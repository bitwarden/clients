import { CollectionExport } from "@bitwarden/common/models/export/collection.export";
import { EMPTY_GUID } from "@bitwarden/common/types/guid";

import { SelectionReadOnly } from "../selection-read-only";

export class OrganizationCollectionRequest extends CollectionExport {
  static template(): OrganizationCollectionRequest {
    const req = new OrganizationCollectionRequest();
    req.organizationId = EMPTY_GUID;
    req.name = "Collection name";
    req.externalId = null;
    req.groups = [SelectionReadOnly.template(), SelectionReadOnly.template()];
    return req;
  }

  groups: SelectionReadOnly[];
}
