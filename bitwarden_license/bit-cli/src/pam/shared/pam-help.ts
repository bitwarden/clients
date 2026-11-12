import { Command } from "commander";

import { CliUtils } from "@bitwarden/cli/utils";

/**
 * Adds the `Notes:` and `Examples:` blocks to a command's `--help`, laid out as the OSS commands
 * lay theirs out.
 */
export function addPamHelp(
  command: Command,
  help: { notes?: readonly string[]; examples: readonly string[] },
): Command {
  return command.on("--help", () => {
    if (help.notes != null && help.notes.length > 0) {
      CliUtils.writeLn("\n  Notes:");
      for (const note of help.notes) {
        CliUtils.writeLn("");
        CliUtils.writeLn(`    ${note}`);
      }
    }
    CliUtils.writeLn("\n  Examples:");
    CliUtils.writeLn("");
    for (const example of help.examples) {
      CliUtils.writeLn(`    ${example}`);
    }
    CliUtils.writeLn("", true);
  });
}
