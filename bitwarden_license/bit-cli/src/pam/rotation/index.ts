import { Command } from "commander";

import { ServiceContainer } from "../../service-container";

import { RotationProgram } from "./rotation.program";

/**
 * Mounts `bw privileged-controls rotation`: rotation configs and schedules. Needs the Pam and PamAccessConnector
 * flags, and the caller must be able to manage rotation in the organization.
 */
export function registerRotation(pam: Command, container: ServiceContainer): void {
  pam.addCommand(new RotationProgram(container).command());
}
