// eslint-disable-next-line no-restricted-imports
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";

export class NoopSdkLoadService extends SdkLoadService {
  async load() {
    return;
  }
}
