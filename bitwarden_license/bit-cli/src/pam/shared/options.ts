import { Command } from "commander";

import { parseGuid } from "@bitwarden/bit-common/pam/shared";

export type PamOrganizationOptions = { organizationid: string };
export type PamNamesOptions = { names?: boolean };

/** Adds the required `--organizationid`, for every org-scoped admin command. */
export function addOrganizationIdOption(command: Command): Command {
  return command.requiredOption(
    "--organizationid <organizationid>",
    "The organization id (required)",
  );
}

/** Adds `--names`, which looks up names from the synced vault and falls back to ids. */
export function addNamesOption(command: Command): Command {
  return command.option(
    "--names",
    "Also print cipher, collection and organization names from the synced vault. Gated items are not synced, so they show their ids.",
  );
}

/**
 * Validates and lowercases an id option.
 * @throws PamInputError when `value` is not a GUID.
 */
export function parseIdOption(value: string | undefined, label: string): string {
  return parseGuid(value, label);
}

/** Validates and lowercases `--organizationid`. */
export function parseOrganizationIdOption(value: string | undefined): string {
  return parseGuid(value, "organization id");
}
