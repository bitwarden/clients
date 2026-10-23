import {
  generateIdentity,
  identityFingerprint,
  initSync,
  WasmRemoteClient,
} from "../wasm-remote/pkg/cloud_fill_remote_wasm";

let initialized: Promise<void> | undefined;

/** Compiles and instantiates the module from the extension package. */
export function ensureWasm(): Promise<void> {
  initialized ??= (async () => {
    const response = await fetch(chrome.runtime.getURL("remote.wasm"));
    initSync({ module: await WebAssembly.compile(await response.arrayBuffer()) });
  })();
  return initialized;
}

export { generateIdentity, identityFingerprint, WasmRemoteClient };
