// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";

export class LockCommand {
  constructor(private vaultTimeoutService: VaultTimeoutService) {}

  async run() {
    await this.vaultTimeoutService.lock();
    process.env.BW_SESSION = null;
    const res = new MessageResponse("Your vault is locked.", null);
    return Response.success(res);
  }
}
