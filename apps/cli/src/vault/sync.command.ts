// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SyncService } from "@bitwarden/common/platform/sync";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";
import { StringResponse } from "../models/response/string.response";
import { CliUtils } from "../utils";

export class SyncCommand {
  constructor(private syncService: SyncService) {}

  async run(cmdOptions: Record<string, any>): Promise<Response> {
    const normalizedOptions = new Options(cmdOptions);
    if (normalizedOptions.last) {
      return await this.getLastSync();
    }

    try {
      await this.syncService.fullSync(normalizedOptions.force, true);
      const res = new MessageResponse("Syncing complete.", null);
      return Response.success(res);
    } catch (e) {
      const response = Response.error(e);
      response.message = "Syncing failed: " + response.message;
      return response;
    }
  }

  private async getLastSync() {
    const lastSyncDate = await this.syncService.getLastSync();
    const res = new StringResponse(lastSyncDate == null ? null : lastSyncDate.toISOString());
    return Response.success(res);
  }
}

class Options {
  last: boolean;
  force: boolean;

  constructor(passedOptions: Record<string, any>) {
    this.last = CliUtils.convertBooleanOption(passedOptions?.last);
    this.force = CliUtils.convertBooleanOption(passedOptions?.force);
  }
}
