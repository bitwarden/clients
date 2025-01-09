import { DeviceApprovalProgram } from "./admin-console/device-approval";
import { ServiceContainer } from "./service-container";

/**
 * All Bitwarden-licensed programs should be registered here.
 * @example
 * const myProgram = new myProgram(serviceContainer);
 * myProgram.register();
 * @param serviceContainer A class that instantiates services and makes them available for dependency injection
 */
export async function registerBitPrograms(serviceContainer: ServiceContainer) {
  new DeviceApprovalProgram(serviceContainer).register();
}
