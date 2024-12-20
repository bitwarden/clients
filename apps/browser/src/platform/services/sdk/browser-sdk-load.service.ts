import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";

import { BrowserApi } from "../../browser/browser-api";

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
  } catch (e) {
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
    console.debug("WebAssembly is supported in this environment");
    loadingPromise = import("./wasm");
  } else {
    // eslint-disable-next-line no-console
    console.debug("WebAssembly is not supported in this environment");
    loadingPromise = import("./fallback");
  }
}

// Manifest v2 expects dynamic imports to prevent timing issues.
async function load() {
  if (BrowserApi.isManifestVersion(3)) {
    // Ensure we have loaded the module
    await loadingPromise;
    return;
  }

  if (supported) {
    // eslint-disable-next-line no-console
    console.debug("WebAssembly is supported in this environment");
    await import("./wasm");
  } else {
    // eslint-disable-next-line no-console
    console.debug("WebAssembly is not supported in this environment");
    await import("./fallback");
  }
}

const loadWithTimeout = async () => {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Operation timed out after 10 second"));
    }, 10000);

    load()
      .then(() => {
        clearTimeout(timer);
        resolve();
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

export class BrowserSdkLoadService implements SdkLoadService {
  constructor(
    readonly platformUtilsService: PlatformUtilsService,
    readonly apiService: ApiService,
    readonly environmentService: EnvironmentService,
    readonly logService: LogService,
  ) {}

  async load(): Promise<void> {
    const startTime = performance.now();

    try {
      await loadWithTimeout();
    } catch (error) {
      throw new Error(`Failed to load: ${(error as Error).message}`);
    }
    const endTime = performance.now();
    const elapsed = Math.round(endTime - startTime);
    const message = `WASM SDK loaded in ${elapsed}ms`;

    this.logService.info(message);

    // If it takes 3 seconds or more to load, we want to capture it.
    if (elapsed >= 3000) {
      await this.logFailureToInitialize(message);
    }
  }

  private async logFailureToInitialize(message: string): Promise<void> {
    // Only log on cloud instances
    if (
      this.platformUtilsService.isDev() ||
      !(await firstValueFrom(this.environmentService.environment$)).isCloud
    ) {
      return;
    }

    return this.apiService.send(
      "POST",
      "/wasm-debug",
      {
        category: "sdk",
        error: message,
      },
      false,
      false,
      undefined,
      (headers) => {
        headers.append("SDK-Version", "1.0.0");
      },
    );
  }
}
