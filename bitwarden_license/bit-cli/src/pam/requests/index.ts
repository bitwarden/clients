import { Command } from "commander";

import { ServiceContainer } from "../../service-container";

import { RequestsProgram } from "./requests.program";

/**
 * Mounts `bw privileged-controls request`: status, create, list, get, activate and cancel.
 */
export function registerRequests(pam: Command, container: ServiceContainer): void {
  pam.addCommand(new RequestsProgram(container).command());
}
