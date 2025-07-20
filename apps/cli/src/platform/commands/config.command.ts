// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OptionValues } from "commander";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";
import { StringResponse } from "../../models/response/string.response";

export class ConfigCommand {
  constructor(
    private environmentService: EnvironmentService,
    private accountService: AccountService,
  ) {}

  async run(setting: string, value: string, options: OptionValues): Promise<Response> {
    setting = setting.toLowerCase();
    switch (setting) {
      case "server":
        return await this.getOrSetServer(value, options);
      default:
        return Response.badRequest("Unknown setting.");
    }
  }

  private async getOrSetServer(url: string, options: OptionValues): Promise<Response> {
    if (
      (url == null || url.trim() === "") &&
      !options.webVault &&
      !options.api &&
      !options.identity &&
      !options.icons &&
      !options.notifications &&
      !options.events
    ) {
      const env = await firstValueFrom(this.environmentService.environment$);
      const stringRes = new StringResponse(
        env.hasBaseUrl() ? env.getUrls().base : "https://bitwarden.com",
      );
      return Response.success(stringRes);
    }

    // The server config cannot be updated while a user is actively logged in to the current server
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount) {
      return Response.error("Logout required before server config update.");
    }

    url = url === "null" || url === "bitwarden.com" || url === "https://bitwarden.com" ? null : url;
    await this.environmentService.setEnvironment(Region.SelfHosted, {
      base: url,
      webVault: options.webVault || null,
      api: options.api || null,
      identity: options.identity || null,
      icons: options.icons || null,
      notifications: options.notifications || null,
      events: options.events || null,
      keyConnector: options.keyConnector || null,
    });
    const res = new MessageResponse("Saved setting `config`.", null);
    return Response.success(res);
  }
}
