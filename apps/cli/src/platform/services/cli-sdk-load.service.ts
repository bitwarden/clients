import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { importSdkWasm } from "@bitwarden/common/platform/services/sdk/wasm-simd";
import * as sdk from "@bitwarden/sdk-internal";

export class CliSdkLoadService extends SdkLoadService {
  async load(): Promise<void> {
    // CLI uses stdout for user interaction / automations so we cannot log info / debug here.
    SdkLoadService.logLevel = sdk.LogLevel.Error;
    const module = await importSdkWasm();
    (sdk as any).init(module);
  }
}
