import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";

import { LogUtils } from "./log-utils";

/**
 * SDK Load Service for the native messaging test runner.
 * For Node.js environments, the SDK's Node.js build automatically loads WASM from the filesystem.
 * No additional initialization is needed.
 */
export class TestRunnerSdkLoadService extends SdkLoadService {
  async load(): Promise<void> {
    // In Node.js, @bitwarden/sdk-internal automatically loads the WASM file
    // from node/bitwarden_wasm_internal_bg.wasm using fs.readFileSync.
    // No explicit loading is required.
  }

  override async loadAndInit(): Promise<void> {
    LogUtils.logInfo("Initializing SDK");
    await super.loadAndInit();
    LogUtils.logSuccess("SDK initialized");
  }
}
