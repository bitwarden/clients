import { DeviceManagementComponentServiceAbstraction } from "@bitwarden/angular/auth/device-management/device-management-component.service.abstraction";

/**
 * Browser extension implementation of the device management component service
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
