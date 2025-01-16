import { CollectionView } from "@bitwarden/admin-console/common";
import { CollectionWithIdExport } from "@bitwarden/common/models/export/collection-with-id.export";

import { BaseResponse } from "../../models/response/base.response";

export class CollectionResponse extends CollectionWithIdExport implements BaseResponse {
  object: string;

  constructor(o: CollectionView) {
    super();
    this.object = "collection";
    this.build(o);
  }
}
