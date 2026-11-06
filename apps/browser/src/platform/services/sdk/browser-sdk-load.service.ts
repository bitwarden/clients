import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { importSdkWasm } from "@bitwarden/common/platform/services/sdk/wasm-simd";
import * as sdk from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

// Due to using webpack as bundler, sync imports will return an async module. Since we do support
// top level awaits, we define a promise we can await in the `load` function.
let loadingPromise: Promise<any> | undefined;

// Manifest v3 does not support dynamic imports in the service worker.
if (BrowserApi.isManifestVersion(3)) {
  loadingPromise = importSdkWasm();
}

// Manifest v2 expects dynamic imports to prevent timing issues.
async function importModule(): Promise<any> {
  if (BrowserApi.isManifestVersion(3)) {
    // Ensure we have loaded the module
    return await loadingPromise;
  }

  return await importSdkWasm();
}

export class BrowserSdkLoadService extends SdkLoadService {
  constructor(readonly logService: LogService) {
    super();
  }

  async load(): Promise<void> {
    const startTime = performance.now();
    (sdk as any).init(await importModule());
    const endTime = performance.now();

    this.logService.info(`WASM SDK loaded in ${Math.round(endTime - startTime)}ms`);
  }
}
