import { Command } from "commander";

import { ServiceContainer } from "../../service-container";

import { LeasesProgram } from "./leases.program";

/** Mounts the `bw privileged-controls` commands for leases: list, extend, end and reveal. */
export function registerLeases(pam: Command, container: ServiceContainer): void {
  pam.addCommand(new LeasesProgram(container).command());
}
