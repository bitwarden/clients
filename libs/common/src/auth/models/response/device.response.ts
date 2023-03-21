import { DeviceType } from "../../../enums/deviceType";
import { BaseResponse } from "../../../models/response/base.response";
import { Guid } from "../../../types/guid";

export class DeviceResponse extends BaseResponse {
  id: Guid;
  name: number;
  identifier: string;
  type: DeviceType;
  creationDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.name = this.getResponseProperty("Name");
    this.identifier = this.getResponseProperty("Identifier");
    this.type = this.getResponseProperty("Type");
    this.creationDate = this.getResponseProperty("CreationDate");
  }
}
