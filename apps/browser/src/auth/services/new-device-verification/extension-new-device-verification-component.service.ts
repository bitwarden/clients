import {
  DefaultNewDeviceVerificationComponentService,
  NewDeviceVerificationComponentService,
} from "@bitwarden/auth/angular";

export class ExtensionNewDeviceVerificationComponentService
  extends DefaultNewDeviceVerificationComponentService
  implements NewDeviceVerificationComponentService
{
  showBackButton() {
    return false;
  }
}
