// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as chalk from "chalk";
import { firstValueFrom, map } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UserId } from "@bitwarden/common/types/guid";

import { UnlockCommand } from "./key-management/commands/unlock.command";
import { Response } from "./models/response";
import { ListResponse } from "./models/response/list.response";
import { MessageResponse } from "./models/response/message.response";
import { StringResponse } from "./models/response/string.response";
import { TemplateResponse } from "./models/response/template.response";
import { ServiceContainer } from "./service-container/service-container";
import { CliUtils } from "./utils";

const writeLn = CliUtils.writeLn;

export abstract class BaseProgram {
  constructor(protected serviceContainer: ServiceContainer) {}

  protected processResponse(response: Response, exitImmediately = false) {
    if (!response.success) {
      if (process.env.BW_QUIET !== "true") {
        if (process.env.BW_RESPONSE === "true") {
          writeLn(this.getJson(response), true, false);
        } else {
          writeLn(chalk.redBright(response.message), true, true);
        }
      }
      const exitCode = process.env.BW_CLEANEXIT ? 0 : 1;
      if (exitImmediately) {
        process.exit(exitCode);
      } else {
        process.exitCode = exitCode;
      }
      return;
    }

    if (process.env.BW_RESPONSE === "true") {
      writeLn(this.getJson(response), true, false);
    } else if (response.data != null) {
      let out: string = null;

      if (response.data.object === "template") {
        out = this.getJson((response.data as TemplateResponse).template);
      }

      if (out == null) {
        if (response.data.object === "string") {
          const data = (response.data as StringResponse).data;
          if (data != null) {
            out = data;
          }
        } else if (response.data.object === "list") {
          out = this.getJson((response.data as ListResponse).data);
        } else if (response.data.object === "message") {
          out = this.getMessage(response);
        } else {
          out = this.getJson(response.data);
        }
      }

      if (out != null && process.env.BW_QUIET !== "true") {
        writeLn(out, true, false);
      }
    }
    if (exitImmediately) {
      process.exit(0);
    } else {
      process.exitCode = 0;
    }
  }

  private getJson(obj: any): string {
    if (process.env.BW_PRETTY === "true") {
      return JSON.stringify(obj, null, "  ");
    } else {
      return JSON.stringify(obj);
    }
  }

  protected getMessage(response: Response): string {
    const message = response.data as MessageResponse;
    if (process.env.BW_RAW === "true") {
      return message.raw;
    }

    let out = "";
    if (message.title != null) {
      if (message.noColor) {
        out = message.title;
      } else {
        out = chalk.greenBright(message.title);
      }
    }
    if (message.message != null) {
      if (message.title != null) {
        out += "\n";
      }
      out += message.message;
    }
    return out.trim() === "" ? null : out;
  }

  protected async exitIfAuthed() {
    const authed = await firstValueFrom(
      this.serviceContainer.authService.activeAccountStatus$.pipe(
        map((status) => status > AuthenticationStatus.LoggedOut),
      ),
    );
    if (authed) {
      const email = await firstValueFrom(
        this.serviceContainer.accountService.activeAccount$.pipe(map((a) => a?.email)),
      );
      this.processResponse(Response.error("You are already logged in as " + email + "."), true);
    }
  }

  /**
   * Exist if no user is authenticated
   * @returns the userId of the active account
   */
  protected async exitIfNotAuthed() {
    const fail = () => this.processResponse(Response.error("You are not logged in."), true);
    const userId = (await firstValueFrom(this.serviceContainer.accountService.activeAccount$))?.id;
    if (!userId) {
      fail();
    }
    const authed = await firstValueFrom(this.serviceContainer.tokenService.hasAccessToken$(userId));
    if (!authed) {
      fail();
    }
    return userId;
  }

  protected async exitIfLocked() {
    const userId = await this.exitIfNotAuthed();

    // If the process.env does not have a BW_SESSION key, then we will never be able to retrieve
    // the auto user key from secure storage. This is because the auto user key is encrypted with
    // the session key.
    const hasUserKey =
      await this.serviceContainer.userAutoUnlockKeyService.setUserKeyInMemoryIfAutoUserKeySet(
        userId,
      );

    if (hasUserKey) {
      // User is unlocked
      return;
    }

    // User is locked
    await this.handleLockedUser(userId);
  }

  private async handleLockedUser(userId: UserId) {
    if (process.env.BW_NOINTERACTION === "true") {
      this.processResponse(Response.error("Vault is locked."), true);
      return;
    }

    // must unlock with interaction allowed
    if (await this.serviceContainer.keyConnectorService.getUsesKeyConnector(userId)) {
      const response = Response.error(
        "Your vault is locked. You must unlock your vault using your session key.\n" +
          "If you do not have your session key, you can get a new one by logging out and logging in again.",
      );
      this.processResponse(response, true);
    } else {
      const command = new UnlockCommand(
        this.serviceContainer.accountService,
        this.serviceContainer.masterPasswordService,
        this.serviceContainer.keyService,
        this.serviceContainer.userVerificationService,
        this.serviceContainer.cryptoFunctionService,
        this.serviceContainer.logService,
        this.serviceContainer.keyConnectorService,
        this.serviceContainer.environmentService,
        this.serviceContainer.organizationApiService,
        this.serviceContainer.logout,
        this.serviceContainer.i18nService,
        this.serviceContainer.masterPasswordUnlockService,
        this.serviceContainer.configService,
      );
      const response = await command.run(null, null);
      if (!response.success) {
        this.processResponse(response, true);
      }
    }
  }

  protected async exitIfFeatureFlagDisabled(featureFlag: FeatureFlag) {
    const enabled = await firstValueFrom(
      this.serviceContainer.configService.getFeatureFlag$(featureFlag),
    );

    if (!enabled) {
      this.processResponse(Response.error("This command is temporarily unavailable."), true);
    }
  }
}
