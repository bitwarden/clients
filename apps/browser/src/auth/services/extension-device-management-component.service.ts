import { DeviceManagementComponentServiceAbstraction } from "@bitwarden/auth/common";

/**
 * Browser extension implementation of the device management component service
 * Hides header information as this is specifically for the browser extension client
 */
export class ExtensionDeviceManagementComponentService
  implements DeviceManagementComponentServiceAbstraction
{
  /**
   * Don't show header information in browser extension client
   */
  showHeaderInformation(): boolean {
    return false;
  }
}
