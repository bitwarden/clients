// Magnify-specific globals. Does not extend src/global.d.ts because that file
// declares `ipc` via a type import of src/preload.ts, which transitively pulls
// the entire desktop IPC/preload tree into the TypeScript compilation and
// generates hundreds of "unused file" warnings.
declare const BIT_ENVIRONMENT: string;

declare interface Window {
  ipc: typeof import("./preload").ipc;
}
