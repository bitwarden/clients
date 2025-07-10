import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";

import { Response } from "../../../models/response";
import { ListResponse } from "../../../models/response/list.response";
import { SendResponse } from "../models/send.response";

export class SendListCommand {
  constructor(
    private sendService: SendService,
    private environmentService: EnvironmentService,
    private searchService: SearchService,
    private accountService: AccountService,
  ) {}

  async run(cmdOptions: Record<string, any>): Promise<Response> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    let sends = await this.sendService.getAllDecryptedFromState(activeUserId);

    const normalizedOptions = new Options(cmdOptions);
    if (normalizedOptions.search != null && normalizedOptions.search.trim() !== "") {
      sends = this.searchService.searchSends(sends, normalizedOptions.search);
    }

    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();
    const res = new ListResponse(sends.map((s) => new SendResponse(s, webVaultUrl)));
    return Response.success(res);
  }
}

class Options {
  search: string;

  constructor(passedOptions: Record<string, any>) {
    this.search = passedOptions?.search;
  }
}
