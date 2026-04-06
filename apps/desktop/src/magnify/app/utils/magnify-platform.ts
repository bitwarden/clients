/*
  MAGNIFY_PLATFORM is set once at process start from the value exposed by the
  preload script. It is synchronous — no IPC round-trip — and can be imported
  anywhere in the magnify renderer to determine the current operating system
  without making repeated IPC calls.

  Possible values mirror Node's process.platform: "darwin", "win32", "linux"
*/
export const MAGNIFY_PLATFORM: string = window?.ipc?.platform ?? "";
