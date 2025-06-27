import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import * as sdk from "@bitwarden/sdk-internal";

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

export class WebSdkLoadService extends SdkLoadService {
  async load(): Promise<void> {
    let module: any;
    if (supported) {
      module = await import("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm");
    } else {
      module = await import("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm.js");
    }
    (sdk as any).init(module);
  }
}
