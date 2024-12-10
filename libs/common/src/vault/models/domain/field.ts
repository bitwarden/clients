// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import Domain from "../../../platform/models/domain/domain-base";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { FieldType, LinkedIdType } from "../../enums";
import { FieldData } from "../data/field.data";
import { FieldView } from "../view/field.view";

export class Field extends Domain {
  name: EncString;
  value: EncString;
  type: FieldType;
  linkedId: LinkedIdType;

  constructor(obj?: FieldData) {
    super();
    if (obj == null) {
      return;
    }

    this.type = obj.type;
    this.linkedId = obj.linkedId;
    this.buildDomainModel(
      this,
      obj,
      {
        name: null,
        value: null,
      },
      [],
    );
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<FieldView> {
    return this.decryptObj(
      new FieldView(this),
      {
        name: null,
        value: null,
      },
      orgId,
      encKey,
    );
  }

  toFieldData(): FieldData {
    const f = new FieldData();
    this.buildDataModel(
      this,
      f,
      {
        name: null,
        value: null,
        type: null,
        linkedId: null,
      },
      ["type", "linkedId"],
    );
    return f;
  }

  static fromJSON(obj: Partial<Jsonify<Field>>): Field {
    if (obj == null) {
      return null;
    }

    const name = EncString.fromJSON(obj.name);
    const value = EncString.fromJSON(obj.value);

    return Object.assign(new Field(), obj, {
      name,
      value,
    });
  }
}
