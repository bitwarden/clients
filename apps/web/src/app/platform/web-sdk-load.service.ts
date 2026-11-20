import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { importSdkWasm } from "@bitwarden/common/platform/services/sdk/wasm-simd";
import * as sdk from "@bitwarden/sdk-internal";

export class WebSdkLoadService extends SdkLoadService {
  async load(): Promise<void> {
    const module = await importSdkWasm(
      () => import("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm.js"),
    );
    (sdk as any).init(module);
  }
}
