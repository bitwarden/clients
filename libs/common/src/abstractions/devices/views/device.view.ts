import { DeviceType } from "../../../enums";
import { View } from "../../../models/view/view";
import { DeviceResponse } from "../responses/device.response";

export class DeviceView implements View {
  id: string;
  userId: string;
  name: string;
  identifier: string;
  type: DeviceType;
  creationDate: string;
  revisionDate: string;

  constructor(deviceResponse: DeviceResponse) {
    Object.assign(this, deviceResponse);
  }
}
