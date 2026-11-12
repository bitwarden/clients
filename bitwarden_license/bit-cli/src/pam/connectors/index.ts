import { Command } from "commander";

import { ServiceContainer } from "../../service-container";

import { ConnectorsProgram } from "./connectors.program";

/**
 * Mounts `bw privileged-controls connector`, the admin commands for access connectors (needs the
 * PamAccessConnector flag).
 */
export function registerConnectors(pam: Command, container: ServiceContainer): void {
  pam.addCommand(new ConnectorsProgram(container).command());
}
