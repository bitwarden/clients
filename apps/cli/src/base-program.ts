import * as chalk from "chalk";
import { firstValueFrom, map } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { UnlockCommand } from "./auth/commands/unlock.command";
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

  protected async exitIfNotAuthed() {
    const authed = await this.serviceContainer.stateService.getIsAuthenticated();
    if (!authed) {
      this.processResponse(Response.error("You are not logged in."), true);
    }
  }

  protected async exitIfLocked() {
    await this.exitIfNotAuthed();
    if (await this.serviceContainer.cryptoService.hasUserKey()) {
      return;
    } else if (process.env.BW_NOINTERACTION !== "true") {
      // must unlock
      if (await this.serviceContainer.keyConnectorService.getUsesKeyConnector()) {
        const response = Response.error(
          "Your vault is locked. You must unlock your vault using your session key.\n" +
            "If you do not have your session key, you can get a new one by logging out and logging in again.",
        );
        this.processResponse(response, true);
      } else {
        const command = new UnlockCommand(
          this.serviceContainer.accountService,
          this.serviceContainer.masterPasswordService,
          this.serviceContainer.cryptoService,
          this.serviceContainer.userVerificationService,
          this.serviceContainer.cryptoFunctionService,
          this.serviceContainer.logService,
          this.serviceContainer.keyConnectorService,
          this.serviceContainer.environmentService,
          this.serviceContainer.syncService,
          this.serviceContainer.organizationApiService,
          this.serviceContainer.logout,
        );
        const response = await command.run(null, null);
        if (!response.success) {
          this.processResponse(response, true);
        }
      }
    } else {
      this.processResponse(Response.error("Vault is locked."), true);
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
