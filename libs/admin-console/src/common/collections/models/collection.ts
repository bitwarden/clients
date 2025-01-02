// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { OrgKey } from "@bitwarden/common/types/key";

import { EncString } from "../../../../../key-management/src/cryptography/domain/enc-string";

import { CollectionData } from "./collection.data";
import { CollectionView } from "./collection.view";

export class Collection extends Domain {
  id: string;
  organizationId: string;
  name: EncString;
  externalId: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;

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
        manage: null,
      },
      ["id", "organizationId", "readOnly", "hidePasswords", "manage"],
    );
  }

  decrypt(orgKey: OrgKey): Promise<CollectionView> {
    return this.decryptObj(
      new CollectionView(this),
      {
        name: null,
      },
      this.organizationId,
      orgKey,
    );
  }
}
