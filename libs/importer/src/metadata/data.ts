/** Mechanisms that load data into the importer. */
export const Loader = Object.freeze({
  /** Data loaded from a file provided by the user/ */
  file: "file",

  /** Data loaded directly from the chromium browser's data store */
  chromium: "chromium",

  /** Data provided through an importer ipc channel (e.g. Bitwarden bridge) */
  ipc: "ipc",

  /** Data provided by a literal file download, saved to disk and then read back.
   *  @remarks Not what LastPass/Keeper's "direct" import modes do today — those authenticate
   *  to the vendor's own API and decrypt the result client-side, in memory, without ever
   *  saving a file. That mechanism isn't represented by any `Loader` value yet; see the
   *  `lastpasscsv`/`keeper` entries in `models/import-options.ts`.
   */
  download: "download",
});

/** Mechanisms that load data into the importer. */
export type DataLoader = (typeof Loader)[keyof typeof Loader];
