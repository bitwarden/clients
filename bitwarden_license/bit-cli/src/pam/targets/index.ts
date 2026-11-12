import { Command } from "commander";

import { ServiceContainer } from "../../service-container";

import { TargetsProgram } from "./targets.program";

/** Mounts `bw pam target` (needs the PamAccessConnector flag). */
export function registerTargets(pam: Command, container: ServiceContainer): void {
  pam.addCommand(new TargetsProgram(container).command());
}
