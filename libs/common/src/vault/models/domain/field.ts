import { Jsonify } from "type-fest";

import { Field as SdkField, LinkedIdType as SdkLinkedIdType } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { FieldType, LinkedIdType } from "../../enums";
import { FieldData } from "../data/field.data";
import { FieldView } from "../view/field.view";

export class Field extends Domain {
  name?: EncString;
  value?: EncString;
  type: FieldType = FieldType.Text;
  linkedId?: LinkedIdType;

  constructor(obj?: FieldData) {
    super();
    if (obj == null) {
      return;
    }

    this.type = obj.type;
    this.linkedId = obj.linkedId ?? undefined;
    this.name = obj.name != null ? new EncString(obj.name) : undefined;
    this.value = obj.value != null ? new EncString(obj.value) : undefined;
  }

  decrypt(orgId: string | undefined, encKey?: SymmetricCryptoKey): Promise<FieldView> {
    return this.decryptObj<Field, FieldView>(
      this,
      new FieldView(this),
      ["name", "value"],
      orgId ?? null,
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

  static fromJSON(obj: Partial<Jsonify<Field>> | undefined): Field | undefined {
    if (obj == null) {
      return undefined;
    }

    const field = new Field();
    field.type = obj.type ?? FieldType.Text;
    field.linkedId = obj.linkedId ?? undefined;
    field.name = obj.name != null ? EncString.fromJSON(obj.name) : undefined;
    field.value = obj.value != null ? EncString.fromJSON(obj.value) : undefined;

    return field;
  }

  /**
   * Maps Field to SDK format.
   *
   * @returns {SdkField} The SDK field object.
   */
  toSdkField(): SdkField {
    return {
      name: this.name?.toSdk(),
      value: this.value?.toSdk(),
      type: this.type,
      // Safe type cast: client and SDK LinkedIdType enums have identical values
      linkedId: this.linkedId as unknown as SdkLinkedIdType,
    };
  }

  /**
   * Maps SDK Field to Field
   * @param obj The SDK Field object to map
   */
  static fromSdkField(obj: SdkField | undefined): Field | undefined {
    if (obj == null) {
      return undefined;
    }

    const field = new Field();
    field.name = obj.name != null ? EncString.fromJSON(obj.name) : undefined;
    field.value = obj.value != null ? EncString.fromJSON(obj.value) : undefined;
    field.type = obj.type;
    field.linkedId = obj.linkedId;

    return field;
  }
}
