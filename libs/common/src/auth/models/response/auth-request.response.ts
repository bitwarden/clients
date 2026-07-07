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
  requestCountryName: string;
  key: string; // Auth-request public-key encrypted user-key. Note: No sender authenticity provided!
  creationDate: string;
  requestApproved?: boolean;
  responseDate?: string;
  isAnswered: boolean;
  isExpired: boolean;
  deviceId?: string; // could be null or empty

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.publicKey = this.getResponseProperty("PublicKey");
    this.requestDeviceType = this.getResponseProperty("RequestDeviceType");
    this.requestDeviceTypeValue = this.getResponseProperty("RequestDeviceTypeValue");
    this.requestDeviceIdentifier = this.getResponseProperty("RequestDeviceIdentifier");
    this.requestIpAddress = this.getResponseProperty("RequestIpAddress");
    this.requestCountryName = this.getResponseProperty("RequestCountryName");
    this.key = this.getResponseProperty("Key");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.requestApproved = this.getResponseProperty("RequestApproved");
    this.responseDate = this.getResponseProperty("ResponseDate");
    this.deviceId = this.getResponseProperty("RequestDeviceId");

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
