import { DeviceType } from "../../../enums";
import { BaseResponse } from "../../../models/response/base.response";

const RequestTimeOut = 60000 * 15; //15 Minutes

export class AuthRequestResponse extends BaseResponse {
  id: string;
  publicKey: string;
  requestDeviceType: string;
  requestDeviceTypeValue: DeviceType;
  requestDeviceIdentifier: string;
  requestIpAddress: string;
  key: string; // could be either an encrypted MasterKey or an encrypted UserKey
  masterPasswordHash: string; // if hash is present, the `key` above is an encrypted MasterKey (else `key` is an encrypted UserKey)
  creationDate: string;
  requestApproved?: boolean;
  responseDate?: string;
  isAnswered: boolean;
  isExpired: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.publicKey = this.getResponseProperty("PublicKey");
    this.requestDeviceType = this.getResponseProperty("RequestDeviceType");
    this.requestDeviceTypeValue = this.getResponseProperty("RequestDeviceTypeValue");
    this.requestDeviceIdentifier = this.getResponseProperty("RequestDeviceIdentifier");
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
      requestDate.getUTCMilliseconds(),
    );

    const dateNow = new Date(Date.now());
    const dateNowUTC = Date.UTC(
      dateNow.getUTCFullYear(),
      dateNow.getUTCMonth(),
      dateNow.getDate(),
      dateNow.getUTCHours(),
      dateNow.getUTCMinutes(),
      dateNow.getUTCSeconds(),
      dateNow.getUTCMilliseconds(),
    );

    this.isExpired = dateNowUTC - requestDateUTC >= RequestTimeOut;
    this.isAnswered = this.requestApproved != null && this.responseDate != null;
  }
}
