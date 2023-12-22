import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

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
      await this.syncService.fullSync(normalizedOptions.force, "sync", true);
      const res = new MessageResponse("Syncing complete.", null);
      return Response.success(res);
    } catch (e) {
      return Response.error("Syncing failed: " + e.toString());
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
