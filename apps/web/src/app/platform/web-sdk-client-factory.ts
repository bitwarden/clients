import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import * as sdk from "@bitwarden/sdk-internal";

/**
 * SDK client factory with a js fallback for when WASM is not supported.
 */
export class WebSdkClientFactory implements SdkClientFactory {
  async createSdkClient(
    ...args: ConstructorParameters<typeof sdk.BitwardenClient>
  ): Promise<sdk.BitwardenClient> {
    const module = await load();

    (sdk as any).init(module);

    return Promise.resolve(new sdk.BitwardenClient(...args));
  }
}

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

async function load() {
  if (supported) {
    return await import("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm");
  } else {
    return await import("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm.js");
  }
}
