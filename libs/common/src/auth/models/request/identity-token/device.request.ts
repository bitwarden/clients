// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { DeviceType } from "../../../../enums";
import { PlatformUtilsService } from "../../../../platform/abstractions/platform-utils.service";

export class DeviceRequest {
  type: DeviceType;
  name: string;
  identifier: string;
  pushToken?: string;

  constructor(appId: string, platformUtilsService: PlatformUtilsService) {
    this.type = platformUtilsService.getDevice();
    this.name = platformUtilsService.getDeviceString();
    this.identifier = appId;
    this.pushToken = null;
  }

  static fromJSON(json: Jsonify<DeviceRequest>) {
    return Object.assign(Object.create(DeviceRequest.prototype), json);
  }
}
