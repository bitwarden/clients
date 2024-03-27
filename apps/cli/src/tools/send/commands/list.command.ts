import { firstValueFrom } from "rxjs";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";

import { Response } from "../../../models/response";
import { ListResponse } from "../../../models/response/list.response";
import { SendResponse } from "../models/send.response";

export class SendListCommand {
  constructor(
    private sendService: SendService,
    private environmentService: EnvironmentService,
    private searchService: SearchService,
  ) {}

  async run(cmdOptions: Record<string, any>): Promise<Response> {
    let sends = await this.sendService.getAllDecryptedFromState();

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
