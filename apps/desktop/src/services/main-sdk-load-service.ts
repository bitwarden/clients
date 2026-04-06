import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import * as sdk from "@bitwarden/sdk-internal";

export class MainSdkLoadService extends SdkLoadService {
  async load(): Promise<void> {
    const module = await import("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm");
    (sdk as any).init(module);
  }
}
