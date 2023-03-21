import { Guid } from "../../types/guid";
import { CollectionData } from "../data/collection.data";
import { CollectionView } from "../view/collection.view";

import Domain from "./domain-base";
import { EncString } from "./enc-string";

export class Collection extends Domain {
  id: Guid;
  organizationId: Guid;
  name: EncString;
  externalId: string;
  readOnly: boolean;
  hidePasswords: boolean;

  constructor(obj?: CollectionData) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        organizationId: null,
        name: null,
        externalId: null,
        readOnly: null,
        hidePasswords: null,
      },
      ["id", "organizationId", "externalId", "readOnly", "hidePasswords"]
    );
  }

  decrypt(): Promise<CollectionView> {
    return this.decryptObj(
      new CollectionView(this),
      {
        name: null,
      },
      this.organizationId
    );
  }
}
