import { TextEncoder, TextDecoder } from "util";

// SDK/WASM code relies on TextEncoder/TextDecoder being available globally
// We can't use `test.environment.ts` because that breaks other tests that rely on
// the default jest jsdom environment
if (!(globalThis as any).TextEncoder) {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (!(globalThis as any).TextDecoder) {
  (globalThis as any).TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}
