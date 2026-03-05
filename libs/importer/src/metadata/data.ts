/** Mechanisms that load data into the importer. */
export const Loader = Object.freeze({
  /** Data loaded from a file provided by the user/ */
  file: "file",

  /** Data loaded directly from the chromium browser's data store */
  chromium: "chromium",

  /** Data provided through an importer ipc channel (e.g. Bitwarden bridge) */
  ipc: "ipc",

  /** Data provided through direct file download (e.g. a LastPass export) */
  download: "download",
});

/** Re-branded products often leave their exporters unaltered; when that occurs,
 *  `Instructions` lets us group them together.
 *
 *  @remarks Instructions values must be mutually exclusive from Loader's values.
 */
export const Instructions = Object.freeze({
  /** the instructions are unique to the import type */
  unique: "unique",

  /** shared chromium instructions */
  chromium: "chromium",
});
