// Magnify-specific globals. Does not extend src/global.d.ts because that file
// declares `ipc` via a type import of src/preload.ts, which transitively pulls
// the entire desktop IPC/preload tree into the TypeScript compilation and
// generates hundreds of "unused file" warnings.
declare const BIT_ENVIRONMENT: string;

interface MagnifyCipherResult {
  id: string;
  name: string;
  username: string;
  faviconUrl?: string;
  hasUri?: boolean;
}

interface MagnifyCommandResult {
  command: string;
  results: MagnifyCipherResult[] | Array<{ password: string }>;
}

declare const magnifyIpc: {
  sendCommand: (payload: object) => void;
  onResults: (fn: (data: MagnifyCommandResult) => void) => void;
  platform: string;
};
