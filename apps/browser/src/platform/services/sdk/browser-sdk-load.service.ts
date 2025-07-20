import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";

import { BrowserApi } from "../../browser/browser-api";

export type GlobalWithWasmInit = typeof globalThis & {
  initSdk: () => void;
};

// https://stackoverflow.com/a/47880734
const supported = (() => {
  try {
    if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
      const module = new WebAssembly.Module(
        Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00),
      );
      if (module instanceof WebAssembly.Module) {
        return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
      }
    }
  } catch {
    // ignore
  }
  return false;
})();

// Due to using webpack as bundler, sync imports will return an async module. Since we do support
// top level awaits, we define a promise we can await in the `load` function.
let loadingPromise: Promise<any> | undefined;

// Manifest v3 does not support dynamic imports in the service worker.
if (BrowserApi.isManifestVersion(3)) {
  if (supported) {
    // eslint-disable-next-line no-console
    console.info("WebAssembly is supported in this environment");
    loadingPromise = import("./wasm");
  } else {
    loadingPromise = new Promise((_, reject) => {
      reject(new Error("WebAssembly is not supported in this environment"));
    });
  }
}

// Manifest v2 expects dynamic imports to prevent timing issues.
async function importModule(): Promise<GlobalWithWasmInit["initSdk"]> {
  if (BrowserApi.isManifestVersion(3)) {
    // Ensure we have loaded the module
    await loadingPromise;
  } else if (supported) {
    // eslint-disable-next-line no-console
    console.info("WebAssembly is supported in this environment");
    await import("./wasm");
  } else {
    throw new Error("WebAssembly is not supported in this environment");
  }

  // the wasm and fallback imports mutate globalThis to add the initSdk function
  return (globalThis as GlobalWithWasmInit).initSdk;
}

export class BrowserSdkLoadService extends SdkLoadService {
  constructor(readonly logService: LogService) {
    super();
  }

  async load(): Promise<void> {
    const startTime = performance.now();
    await importModule().then((initSdk) => initSdk());
    const endTime = performance.now();

    this.logService.info(`WASM SDK loaded in ${Math.round(endTime - startTime)}ms`);
  }
}
