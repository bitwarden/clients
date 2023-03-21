import { Guid } from "../../types/guid";
import { Collection } from "../domain/collection";
import { ITreeNodeObject } from "../domain/tree-node";
import { CollectionAccessDetailsResponse } from "../response/collection.response";

import { View } from "./view";

export class CollectionView implements View, ITreeNodeObject {
  id: Guid = null;
  organizationId: Guid = null;
  name: string = null;
  externalId: string = null;
  readOnly: boolean = null;
  hidePasswords: boolean = null;

  constructor(c?: Collection | CollectionAccessDetailsResponse) {
    if (!c) {
      return;
    }

    this.id = c.id;
    this.organizationId = c.organizationId;
    this.externalId = c.externalId;
    if (c instanceof Collection) {
      this.readOnly = c.readOnly;
      this.hidePasswords = c.hidePasswords;
    }
  }
}
