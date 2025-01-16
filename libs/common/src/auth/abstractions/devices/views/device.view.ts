// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DeviceType } from "../../../../enums";
import { View } from "../../../../models/view/view";
import { DeviceResponse } from "../responses/device.response";

export class DeviceView implements View {
  id: string;
  userId: string;
  name: string;
  identifier: string;
  type: DeviceType;
  creationDate: string;
  revisionDate: string;
  response: DeviceResponse;

  constructor(deviceResponse: DeviceResponse) {
    Object.assign(this, deviceResponse);
  }
}
