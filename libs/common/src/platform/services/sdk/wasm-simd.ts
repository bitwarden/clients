// Smallest module using a SIMD opcode: `() -> v128 { i8x16.popcnt(i8x16.splat(0)) }`.
// SIMD is the newest feature the SDK .wasm enables, so engines compiling this run the SIMD build.
// prettier-ignore
const SIMD_PROBE = Uint8Array.of(
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // header
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, // type: () -> v128
  0x03, 0x02, 0x01, 0x00, // function: type 0
  0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41, 0x00, 0xfd, 0x0f, 0xfd, 0x62, 0x0b, // code
);

// Empty module: header only.
const WASM_PROBE = Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00);

// True when the runtime compiles and instantiates `probe`. False when WebAssembly is missing.
// https://stackoverflow.com/a/47880734
function instantiates(probe: BufferSource): boolean {
  try {
    const module = new WebAssembly.Module(probe);
    return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
  } catch {
    return false;
  }
}

/**
 * True when the runtime runs WebAssembly SIMD. Selects the SIMD or MVP build of the SDK.
 * Also false when WebAssembly itself is unsupported.
 */
const wasmSimdSupported = instantiates(SIMD_PROBE);

const wasmSupported = instantiates(WASM_PROBE);

/**
 * Imports the SIMD build of the SDK .wasm, or the MVP build on engines without SIMD.
 *
 * @param jsFallback Loads the JS build on engines without WebAssembly. Passed by the caller
 * so only apps shipping the JS build bundle it.
 * @throws Rejects when WebAssembly is unsupported and no `jsFallback` is given. Async so
 * callers loading at module evaluation (e.g. the MV3 service worker) get a rejection, not a throw.
 */
export async function importSdkWasm(jsFallback?: () => Promise<unknown>): Promise<unknown> {
  if (wasmSimdSupported) {
    return import("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm");
  }

  if (wasmSupported) {
    return import("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.mvp.wasm");
  }

  if (jsFallback == null) {
    throw new Error("WebAssembly is not supported in this environment");
  }

  return jsFallback();
}
