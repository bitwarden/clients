import * as sdk from "@bitwarden/sdk-internal";
import * as wasm from "@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm.js";

import { GlobalWithWasmInit } from "src/platform/services/sdk/browser-sdk-load.service";

(globalThis as GlobalWithWasmInit).initSdk = () => {
  (sdk as any).init(wasm);
};
