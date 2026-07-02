import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { isRiskableLoginCipher } from "@bitwarden/common/vault/services/default-cipher-risk.service";

import { Response } from "../models/response";
import { ListResponse } from "../models/response/list.response";
import { PasswordHealthResponse } from "../models/response/password-health.response";

const SPINNER_FRAMES = ["|", "/", "-", "\\"];

export class ReportCommand {
  constructor(
    private cipherService: CipherService,
    private cipherRiskService: CipherRiskService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

  async run(object: string, cmdOptions: Record<string, any>): Promise<Response> {
    switch (object.toLowerCase()) {
      case "password-health":
        return await this.passwordHealth(cmdOptions);
      default:
        return Response.badRequest("Unknown object. Allowed objects are: password-health.");
    }
  }

  private async passwordHealth(cmdOptions: Record<string, any>): Promise<Response> {
    // Commander represents `--no-check-exposed` as `checkExposed === false`.
    const checkExposed = cmdOptions.checkExposed !== false;

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const ciphers = await this.cipherService.getAllDecrypted(userId);
    // Filter once: drives both the progress count and the result-name lookup.
    const logins = ciphers.filter(isRiskableLoginCipher);
    const names = new Map<string, string>(logins.map((c) => [c.id, c.name]));

    try {
      // HIBP checks hit the network per login; show progress on stderr (stdout is the JSON result).
      const message = checkExposed
        ? `Checking ${logins.length} logins against Have I Been Pwned`
        : `Analyzing ${logins.length} logins`;
      const results = await this.withProgress(message, async () => {
        const passwordMap = await this.cipherRiskService.buildPasswordReuseMap(logins, userId);
        return this.cipherRiskService.computeRiskForCiphers(logins, userId, {
          passwordMap,
          checkExposed,
        });
      });

      const rows = results.map(
        (result) => new PasswordHealthResponse(result, names.get(uuidAsString(result.id)) ?? ""),
      );
      return Response.success(new ListResponse(rows));
    } catch (e) {
      this.logService.error(`Failed to generate password health report: ${e}`);
      return Response.error("Failed to generate password health report.");
    }
  }

  /**
   * Runs {@link work} with a progress indicator on stderr. Silent under `BW_QUIET`, and a single
   * static line when stderr isn't a TTY. Never writes to stdout.
   */
  private async withProgress<T>(message: string, work: () => Promise<T>): Promise<T> {
    const quiet = process.env.BW_QUIET === "true";
    const stderr = process.stderr;

    if (quiet) {
      return await work();
    }

    if (!stderr.isTTY) {
      stderr.write(`${message}...\n`);
      return await work();
    }

    let frame = 0;
    const timer = setInterval(() => {
      stderr.write(`\r${SPINNER_FRAMES[frame++ % SPINNER_FRAMES.length]} ${message}...`);
    }, 100);

    try {
      return await work();
    } finally {
      clearInterval(timer);
      // Clear the spinner line.
      stderr.write("\r\x1b[K");
    }
  }
}
