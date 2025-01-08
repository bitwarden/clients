import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";

export class NoopSdkLoadService extends SdkLoadService {
  async load() {
    return;
  }
}
