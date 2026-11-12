import { Command } from "commander";

import { Response } from "@bitwarden/cli/models/response";

/** The option every destructive verb takes. */
export type PamYesOptions = { yes?: boolean };

/**
 * The destructive policy: a verb that ends a lease, deletes a rule or otherwise cannot be undone
 * needs an explicit `--yes` and never prompts, so it behaves the same under `--nointeraction`
 * and in a script.
 */
export function addYesOption(command: Command): Command {
  return command.option("--yes", "Confirm this destructive action. It never prompts.");
}

/**
 * Returns the refusal when `--yes` was not given, else `undefined`.
 * @param action What would happen, such as `end this lease`.
 */
export function requireYes(options: PamYesOptions, action: string): Response | undefined {
  return options.yes === true
    ? undefined
    : Response.badRequest(`This would ${action}. Run the command again with --yes to confirm.`);
}
