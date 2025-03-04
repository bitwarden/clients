import { DeviceType } from "../../../../enums";
import { View } from "../../../../models/view/view";
import { DeviceResponse } from "../responses/device.response";

export class DeviceView implements View {
  id: string | undefined;
  userId: string | undefined;
  name: string | undefined;
  identifier: string | undefined;
  type: DeviceType | undefined;
  creationDate: string | undefined;
  revisionDate: string | undefined;
  response: DeviceResponse | undefined;

  constructor(deviceResponse: DeviceResponse) {
    Object.assign(this, deviceResponse);
    this.response = deviceResponse;
  }
}
