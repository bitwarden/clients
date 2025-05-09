import { DeviceManagementComponentServiceAbstraction } from "@bitwarden/auth/common";

/**
 * Default implementation of the device management component service
 * Shows header information as this is the default behavior for web client
 */
export class DefaultDeviceManagementComponentService
  implements DeviceManagementComponentServiceAbstraction
{
  /**
   * Show header information in web client
   */
  showHeaderInformation(): boolean {
    return true;
  }
}
