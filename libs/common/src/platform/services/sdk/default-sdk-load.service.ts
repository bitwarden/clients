// eslint-disable-next-line no-restricted-imports -- TODO MDG: fix this import restriction error
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import * as sdk from "@bitwarden/sdk-internal";
import * as module from "@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm";

/**
 * Directly imports the Bitwarden SDK and initializes it.
 *
 * **Warning**: This requires WASM support and will fail if the environment does not support it.
 */
export class DefaultSdkLoadService implements SdkLoadService {
  async load(): Promise<void> {
    (sdk as any).init(module);
  }
}
