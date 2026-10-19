import { deepFreeze } from "@bitwarden/common/tools/util";

import { Loader } from "../metadata/data";

import { ImportOption, ImportOptionData, importOptionsById } from "./import-options";

// TODO: remove once pm-35053-import-upgrade is retired

const bitwardenExportHelp = "https://bitwarden.com/help/export-your-data/";

/** `importOptionsById` plus the picker vendor entries and format overrides the upgraded import
 *  flow needs. Only the upgraded flow reads this; the legacy dropdown and the CLI keep using
 *  `importOptionsById`. */
export const importUpgradeOptionsById = deepFreeze({
  ...importOptionsById,
  bitwarden: {
    name: "Bitwarden",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv", "json"],
    pasteFormats: ["csv", "json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "Bitwarden",
    instructionLink: bitwardenExportHelp,
  },
  dashlane: {
    name: "Dashlane",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv", "json"],
    pasteFormats: ["csv", "json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importDashlaneCsvInstructions",
  },
  keepass: {
    name: "KeePass",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["kdbx", "xml", "csv"],
    pasteFormats: ["xml", "csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "KeePass",
    instructionLink: "https://bitwarden.com/help/import-from-keepass/",
  },
  keepass2xml: {
    name: "KeePass 2 (xml)",
    featuredImporter: true,
    isBrowser: false,
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "KeePass",
    instructionLink: "https://bitwarden.com/help/import-from-keepass/",
  },
  keepassxcsv: {
    name: "KeePassX (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "KeePass",
    instructionLink: "https://bitwarden.com/help/import-from-keepass/",
  },
  "1password": {
    name: "1Password",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["1pux", "json", "1pif", "csv"],
    pasteFormats: ["json", "1pif", "csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  "1passwordwincsv": {
    name: "1Password 6 and 7 Windows .csv",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  "1passwordmaccsv": {
    name: "1Password 6 and 7 Mac .csv",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  enpass: {
    name: "Enpass",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv", "json"],
    pasteFormats: ["csv", "json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importEnpassCsvInstructions",
  },
  avast: {
    name: "Avast",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv", "json"],
    pasteFormats: ["csv", "json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importAvastCsvInstructions",
  },
  delinea: {
    name: "Delinea",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["xml", "csv"],
    pasteFormats: ["xml", "csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importDelineaInstructions",
  },
} as const satisfies Record<string, ImportOptionData>);

export type UpgradeImportType = keyof typeof importUpgradeOptionsById;

export const importUpgradeOptions: readonly ImportOption[] = Object.entries(
  importUpgradeOptionsById,
).map(([id, option]) => ({ id, ...option }));
