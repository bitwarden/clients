import { FieldType, LinkedIdType } from "../../enums";
import { FieldApi } from "../api/field.api";

export class FieldData {
  type: FieldType = FieldType.Text;
  name?: string;
  value?: string;
  linkedId?: LinkedIdType;

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
