import { Jsonify } from "type-fest";

import { Field as SdkField, EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import {
  FieldType,
  LinkedIdType,
  normalizeFieldTypeForSdk,
  normalizeLinkedIdTypeForSdk,
} from "../../enums";
import { FieldData } from "../data/field.data";

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
    this.name = (obj.name ?? undefined) as EncString;
    this.value = (obj.value ?? undefined) as EncString;
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
    field.name = obj.name ?? undefined;
    field.value = obj.value ?? undefined;

    return field;
  }

  /**
   * Maps Field to SDK format.
   *
   * @returns {SdkField} The SDK field object.
   */
  toSdkField(): SdkField {
    return {
      name: this.name ?? undefined,
      value: this.value ?? undefined,
      type: normalizeFieldTypeForSdk(this.type),
      linkedId: normalizeLinkedIdTypeForSdk(this.linkedId),
    };
  }

  /**
   * Maps SDK Field to Field
   * @param obj The SDK Field object to map
   */
  static fromSdkField(obj?: SdkField): Field | undefined {
    if (obj == null) {
      return undefined;
    }

    const field = new Field();
    field.name = obj.name ?? undefined;
    field.value = obj.value ?? undefined;
    field.type = obj.type;
    field.linkedId = obj.linkedId;

    return field;
  }
}
