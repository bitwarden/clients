// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";
import { FieldType, LinkedIdType } from "../../enums";

export class FieldApi extends BaseResponse {
  name: string;
  value: string;
  type: FieldType;
  linkedId: LinkedIdType;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.type = this.getResponseProperty("Type");
    this.name = this.getResponseProperty("Name");
    this.value = this.getResponseProperty("Value");
    this.linkedId = this.getResponseProperty("linkedId");
  }
}
