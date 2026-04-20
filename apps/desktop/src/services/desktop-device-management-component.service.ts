import { DeviceManagementComponentServiceAbstraction } from "@bitwarden/angular/auth/device-management/device-management-component.service.abstraction";

/**
 * Desktop implementation of the device management component service
 */
export class DesktopDeviceManagementComponentService implements DeviceManagementComponentServiceAbstraction {
  /**
   * Don't show header information in desktop dialog context
   */
  showHeaderInformation(): boolean {
    return false;
  }
}
