import { firstValueFrom } from "rxjs";

import { LockService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";

export class LockCommand {
  constructor(
    private lockService: LockService,
    private accountService: AccountService,
  ) {}

  async run() {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    await this.lockService.lock(activeUserId);
    process.env.BW_SESSION = undefined;
    const res = new MessageResponse("Your vault is locked.", null);
    return Response.success(res);
  }
}
