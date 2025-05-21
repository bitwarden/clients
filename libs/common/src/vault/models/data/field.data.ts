// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType, LinkedIdType } from "../../enums";
import { FieldApi } from "../api/field.api";

export class FieldData {
  type: FieldType;
  name: string;
  value: string;
  linkedId: LinkedIdType;

  constructor(response?: FieldApi) {
    if (response == null) {
      return;
    }
    this.type = response.type;
    this.name = response.name;
    this.value = response.value;
    this.linkedId = response.linkedId;
  }
}
