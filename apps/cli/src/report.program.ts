import { program, Command, OptionValues } from "commander";

import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { BaseProgram } from "./base-program";
import { ReportCommand } from "./commands/report.command";
import { Response } from "./models/response";
import { CliUtils } from "./utils";

const writeLn = CliUtils.writeLn;

export class ReportProgram extends BaseProgram {
  async register() {
    program.addCommand(this.reportCommand());
  }

  private reportCommand(): Command {
    const reportObjects = ["password-health"];

    return new Command("report")
      .argument("<object>", "Valid objects are: " + reportObjects.join(", "))
      .description("Generate a vault report.")
      .option(
        "--no-check-exposed",
        "Skip checking passwords against the Have I Been Pwned breach database (avoids network requests).",
      )
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn(
          "    password-health reports each login's password strength (0-4), how many times the",
        );
        writeLn(
          "    password is reused, and whether it appears in a known data breach (Have I Been Pwned).",
        );
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw report password-health");
        writeLn("    bw report password-health --no-check-exposed");
        writeLn("    bw report password-health --pretty");
        writeLn("", true);
      })
      .action(async (object: string, options: OptionValues) => {
        if (!this.validateObject(object, reportObjects)) {
          return;
        }

        await this.exitIfLocked();
        const command = new ReportCommand(
          // serviceContainer exposes the concrete (not-yet-strict) CipherService; cast to the abstraction.
          this.serviceContainer.cipherService as CipherService,
          this.serviceContainer.cipherRiskService,
          this.serviceContainer.accountService,
          this.serviceContainer.logService,
        );
        const response = await command.run(object, options);

        this.processResponse(response);
      });
  }

  private validateObject(requestedObject: string, validObjects: string[]): boolean {
    if (!validObjects.includes(requestedObject)) {
      this.processResponse(
        Response.badRequest(
          'Unknown object "' +
            requestedObject +
            '". Allowed objects are: ' +
            validObjects.join(", ") +
            ".",
        ),
      );
      return false;
    }
    return true;
  }
}
