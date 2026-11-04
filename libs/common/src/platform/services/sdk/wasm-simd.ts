// Smallest module using a SIMD opcode: `() -> v128 { i8x16.popcnt(i8x16.splat(0)) }`.
// SIMD is the newest feature the SDK .wasm enables, so engines compiling this run the SIMD build.
// prettier-ignore
const SIMD_PROBE = Uint8Array.of(
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // header
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, // type: () -> v128
  0x03, 0x02, 0x01, 0x00, // function: type 0
  0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41, 0x00, 0xfd, 0x0f, 0xfd, 0x62, 0x0b, // code
);

/**
 * True when the runtime compiles WebAssembly SIMD. Selects the SIMD or MVP build of the SDK.
 */
export const wasmSimdSupported = (() => {
  try {
    return new WebAssembly.Module(SIMD_PROBE) instanceof WebAssembly.Module;
  } catch {
    return false;
  }
})();
