import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LockService, LockSource } from "@bitwarden/unlock";

import { CliSharedUnlockService } from "../../key-management/cli-shared-unlock.service";
import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";

export class LockCommand {
  constructor(
    private lockService: LockService,
    private accountService: AccountService,
    private cliSharedUnlockService: CliSharedUnlockService,
  ) {}

  async run() {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    // Started before the lock, so the shared unlock peer announces it to the desktop app. A lock
    // that left a peer holding the user key would be undone by the next `bw unlock`.
    await this.cliSharedUnlockService.start();

    await this.lockService.lock(activeUserId, LockSource.Manual);
    delete process.env.BW_SESSION;
    const res = new MessageResponse("Your vault is locked.", null);
    return Response.success(res);
  }
}
