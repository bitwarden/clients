import { Command } from "commander";

import { ServiceContainer } from "../../service-container";

import { RuleProgram } from "./rule.program";

/** Mounts `bw pam rule`: list, get, template, create, update, enable, disable, delete, bypassable and validate-cidr. */
export function registerRules(pam: Command, container: ServiceContainer): void {
  pam.addCommand(new RuleProgram(container).command());
}
