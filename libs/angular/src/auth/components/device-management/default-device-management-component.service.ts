import { DeviceManagementComponentServiceAbstraction } from "@bitwarden/auth/common";

/**
 * Default implementation of the device management component service
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
