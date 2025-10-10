import { firstValueFrom } from "rxjs";

import { LockService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";

export class LockCommand {
  constructor(
    private lockService: LockService,
    private accountService: AccountService,
  ) {}

  async run() {
    const activeAccountId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    await this.lockService.lock(activeAccountId);
    process.env.BW_SESSION = null;
    const res = new MessageResponse("Your vault is locked.", null);
    return Response.success(res);
  }
}
