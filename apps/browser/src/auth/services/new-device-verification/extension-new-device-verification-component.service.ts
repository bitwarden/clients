import {
  DefaultNewDeviceVerificationComponentService,
  NewDeviceVerificationComponentService,
} from "@bitwarden/angular/auth";

export class ExtensionNewDeviceVerificationComponentService
  extends DefaultNewDeviceVerificationComponentService
  implements NewDeviceVerificationComponentService
{
  showBackButton() {
    return false;
  }
}
