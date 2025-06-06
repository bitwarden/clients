// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
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
