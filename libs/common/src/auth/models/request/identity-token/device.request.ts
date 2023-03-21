import { PlatformUtilsService } from "../../../../abstractions/platformUtils.service";
import { DeviceType } from "../../../../enums/deviceType";
import { Guid } from "../../../../types/guid";

export class DeviceRequest {
  type: DeviceType;
  name: string;
  identifier: string;
  pushToken?: string;

  constructor(appId: Guid, platformUtilsService: PlatformUtilsService) {
    this.type = platformUtilsService.getDevice();
    this.name = platformUtilsService.getDeviceString();
    this.identifier = appId;
    this.pushToken = null;
  }
}
