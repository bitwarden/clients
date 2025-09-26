import { NewDeviceVerificationComponentService } from "./new-device-verification-component.service";

export class DefaultNewDeviceVerificationComponentService
  implements NewDeviceVerificationComponentService
{
  showBackButton() {
    return true;
  }
}
