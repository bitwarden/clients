import { DeviceType } from "../../../enums/deviceType";
import { BaseResponse } from "../../../models/response/base.response";
import { Guid } from "../../../types/guid";

const RequestTimeOut = 60000 * 15; //15 Minutes

export class AuthRequestResponse extends BaseResponse {
  id: Guid;
  publicKey: string;
  requestDeviceType: DeviceType;
  requestIpAddress: string;
  key: string;
  masterPasswordHash: string;
  creationDate: string;
  requestApproved?: boolean;
  responseDate?: string;
  isAnswered: boolean;
  isExpired: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.publicKey = this.getResponseProperty("PublicKey");
    this.requestDeviceType = this.getResponseProperty("RequestDeviceType");
    this.requestIpAddress = this.getResponseProperty("RequestIpAddress");
    this.key = this.getResponseProperty("Key");
    this.masterPasswordHash = this.getResponseProperty("MasterPasswordHash");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.requestApproved = this.getResponseProperty("RequestApproved");
    this.responseDate = this.getResponseProperty("ResponseDate");

    const requestDate = new Date(this.creationDate);
    const requestDateUTC = Date.UTC(
      requestDate.getUTCFullYear(),
      requestDate.getUTCMonth(),
      requestDate.getDate(),
      requestDate.getUTCHours(),
      requestDate.getUTCMinutes(),
      requestDate.getUTCSeconds(),
      requestDate.getUTCMilliseconds()
    );

    const dateNow = new Date(Date.now());
    const dateNowUTC = Date.UTC(
      dateNow.getUTCFullYear(),
      dateNow.getUTCMonth(),
      dateNow.getDate(),
      dateNow.getUTCHours(),
      dateNow.getUTCMinutes(),
      dateNow.getUTCSeconds(),
      dateNow.getUTCMilliseconds()
    );

    this.isExpired = dateNowUTC - requestDateUTC >= RequestTimeOut;
    this.isAnswered = this.requestApproved != null && this.responseDate != null;
  }
}
