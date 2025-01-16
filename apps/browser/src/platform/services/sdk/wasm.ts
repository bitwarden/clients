import * as sdk from "@bitwarden/sdk-internal";
import * as wasm from "@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm";

(globalThis as any).init_sdk = (...args: ConstructorParameters<typeof sdk.BitwardenClient>) => {
  (sdk as any).init(wasm);

  return new sdk.BitwardenClient(...args);
};
