import { DeviceType } from "../../../../enums";
import { View } from "../../../../models/view/view";
import { DevicePendingAuthRequest, DeviceResponse } from "../responses/device.response";

// TODO: tech debt - this view should map response model properties into useful display
// properties such as actual dates vs strings.
export class DeviceView implements View {
  id: string | undefined;
  userId: string | undefined;
  name: string | undefined;
  identifier: string | undefined;
  type: DeviceType | undefined;
  creationDate: string | undefined;
  revisionDate: string | undefined;
  isTrusted: boolean | undefined;
  encryptedUserKey: string | null | undefined;
  encryptedPublicKey: string | null | undefined;
  devicePendingAuthRequest: DevicePendingAuthRequest | null | undefined;
  lastActivityDate: string | null | undefined;

  constructor(deviceResponse: DeviceResponse) {
    Object.assign(this, deviceResponse);
  }
}
