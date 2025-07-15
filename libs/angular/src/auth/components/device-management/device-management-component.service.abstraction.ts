/**
 * Service abstraction for device management component
 * Used to determine client-specific behavior
 */
export abstract class DeviceManagementComponentServiceAbstraction {
  /**
   * Whether to show header information (title, description, etc.) in the device management component
   * @returns true if header information should be shown, false otherwise
   */
  abstract showHeaderInformation(): boolean;
}
