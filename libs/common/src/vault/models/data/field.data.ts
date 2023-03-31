import { FieldType } from "../../../enums/field-type";
import { LinkedIdType } from "../../../enums/linked-id-type";
import { FieldApi } from "../../../models/api/field.api";

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
