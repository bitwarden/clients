import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";

export class NoopSdkLoadService extends SdkLoadService {
  async load() {
    throw new Error("SDK not available in this environment");
  }
  protected log(message: string): void {
  }
}