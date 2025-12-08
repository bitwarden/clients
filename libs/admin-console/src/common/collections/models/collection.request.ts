import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export abstract class BaseCollectionRequest {
  externalId: string | undefined;
  groups: SelectionReadOnlyRequest[] = [];
  users: SelectionReadOnlyRequest[] = [];

  static isUpdate = (request: BaseCollectionRequest): request is UpdateCollectionRequest => {
    return request instanceof UpdateCollectionRequest;
  };

  protected constructor(c: {
    users?: SelectionReadOnlyRequest[];
    groups?: SelectionReadOnlyRequest[];
    externalId?: string;
  }) {
    this.externalId = c.externalId;

    if (c.groups) {
      this.groups = c.groups;
    }
    if (c.users) {
      this.users = c.users;
    }
  }
}

export class CreateCollectionRequest extends BaseCollectionRequest {
  name: string;

  constructor(c: {
    name: EncString;
    users?: SelectionReadOnlyRequest[];
    groups?: SelectionReadOnlyRequest[];
    externalId?: string;
  }) {
    super(c);

    if (!c.name || !c.name.encryptedString) {
      throw new Error("Name not provided for CollectionRequest.");
    }

    this.name = c.name.encryptedString;
  }
}

export class UpdateCollectionRequest extends BaseCollectionRequest {
  name: string | null;

  constructor(c: {
    name: EncString | null;
    users?: SelectionReadOnlyRequest[];
    groups?: SelectionReadOnlyRequest[];
    externalId?: string;
  }) {
    super(c);
    this.name = c.name?.encryptedString ?? null;
  }
}
