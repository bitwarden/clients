import { AppIdService as AppIdServiceAbstraction } from "../abstractions/app-id.service";
import { LogService } from "../abstractions/log.service";
import { AbstractStorageService } from "../abstractions/storage.service";
import { Utils } from "../misc/utils";

export const APP_ID_KEY = "global_applicationId_appId";
export const ANONYMOUS_APP_ID_KEY = "global_applicationId_appId";

export class AppIdService implements AppIdServiceAbstraction {
  constructor(
    private readonly storageService: AbstractStorageService,
    private readonly logService: LogService,
  ) {}

  async getAppId(): Promise<string> {
    this.logService.info("Retrieving application id");
    return await this.getEnsuredValue(APP_ID_KEY);
  }

  async getAnonymousAppId(): Promise<string> {
    return await this.getEnsuredValue(ANONYMOUS_APP_ID_KEY);
  }

  private async getEnsuredValue(key: string) {
    let value = await this.storageService.get<string | null>(key);

    if (value == null) {
      value = Utils.newGuid();
      await this.storageService.save(key, value);
    }

    return value;
  }
}
