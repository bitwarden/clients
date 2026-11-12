import { Command } from "commander";

import { ServiceContainer } from "../../service-container";

import { PamStatusProgram } from "./pam-status.program";

/**
 * Mounts `bw pam status` and `bw pam collections`: the caller's own PAM readiness and the
 * organization's governed collections.
 */
export function registerStatus(pam: Command, container: ServiceContainer): void {
  new PamStatusProgram(container).register(pam);
}
