// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";

export class LogoutCommand {
  constructor(
    private authService: AuthService,
    private i18nService: I18nService,
    private logoutCallback: () => Promise<void>,
  ) {}

  async run() {
    await this.logoutCallback();
    this.authService.logOut(() => {
      /* Do nothing */
    });
    const res = new MessageResponse("You have logged out.", null);
    return Response.success(res);
  }
}
