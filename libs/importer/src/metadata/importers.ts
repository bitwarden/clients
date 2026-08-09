import { deepFreeze } from "@bitwarden/common/tools/util";

import { ImportType } from "../models";

import { Loader } from "./data";
import { ImporterMetadata } from "./types";

export type ImportersMetadata = Record<ImportType, ImporterMetadata>;

const bitwardenExportHelp = "https://bitwarden.com/help/export-your-data/";
const chromeImportHelp = "https://bitwarden.com/help/import-from-chrome/";

/** List of all supported importers and their default capabilities.
 * The `loaders` listed here are a baseline, not an upper bound: on Desktop,
 * `DesktopImportMetadataService` augments this table at runtime with `Loader.chromium` for
 * whichever Chromium-family browsers are actually installed on the current machine — a client
 * can see MORE loaders than are listed here. See
 * apps/desktop/src/app/tools/import/desktop-import-metadata.service.ts.
 */
export const Importers: ImportersMetadata = deepFreeze({
  bitwardenjson: {
    type: "bitwardenjson",
    loaders: [Loader.file],
    sourceName: "Bitwarden",
    instructionLink: bitwardenExportHelp,
  },
  bitwardencsv: {
    type: "bitwardencsv",
    loaders: [Loader.file],
    sourceName: "Bitwarden",
    instructionLink: bitwardenExportHelp,
  },
  // `loaders` here is `[Loader.file]` for chromecsv and every other Chromium-family entry
  // below, deliberately: this static table is the baseline for clients Desktop doesn't
  // override (web/browser/cli). On Desktop, chromecsv gets `Loader.chromium` merged in at
  // runtime exactly like its siblings, when Chrome itself is detected as installed — it is
  // not excluded from that detection.
  chromecsv: {
    type: "chromecsv",
    loaders: [Loader.file],
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  dashlanecsv: {
    type: "dashlanecsv",
    loaders: [Loader.file],
    instructionKey: "importDashlaneCsvInstructions",
  },
  firefoxcsv: {
    type: "firefoxcsv",
    loaders: [Loader.file],
    sourceName: "Firefox",
    instructionLink: "https://bitwarden.com/help/import-from-firefox/",
  },
  keepass2xml: {
    type: "keepass2xml",
    loaders: [Loader.file],
    instructionKey: "importKeepass2Instructions",
  },
  // Keeper and LastPass (below) each also have a "direct" import mode — authenticate to the
  // vendor's own API, fetch, decrypt client-side in memory — gated by a standalone ClientType
  // check in their components (ImportKeeperComponent, showLastPassToggle) rather than by
  // anything in this table. `loaders` here only covers the file/CSV fallback both vendors also
  // support; no `Loader` value describes the direct mode yet (see `data.ts`).
  keeper: {
    type: "keeper",
    loaders: [Loader.file],
    sourceName: "Keeper",
    instructionLink: "https://bitwarden.com/help/import-from-keeper/",
  },
  lastpasscsv: {
    type: "lastpasscsv",
    loaders: [Loader.file],
    sourceName: "LastPass",
    instructionLink: "https://bitwarden.com/help/import-from-lastpass/",
  },
  safaricsv: {
    type: "safaricsv",
    loaders: [Loader.file],
    sourceName: "Safari",
    instructionLink: "https://bitwarden.com/help/import-from-safari/",
  },
  "1password1pux": {
    type: "1password1pux",
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  keepasskdbx: {
    type: "keepasskdbx",
    loaders: [Loader.file],
    sourceName: "KeePass",
    instructionLink: "https://bitwarden.com/help/import-from-keepass/",
  },
  keepassxcsv: {
    type: "keepassxcsv",
    loaders: [Loader.file],
    instructionKey: "importKeepassxInstructions",
  },
  "1password1pif": {
    type: "1password1pif",
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  "1passwordwincsv": {
    type: "1passwordwincsv",
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  "1passwordmaccsv": {
    type: "1passwordmaccsv",
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  dashlanejson: {
    type: "dashlanejson",
    loaders: [Loader.file],
    instructionKey: "importDashlaneJsonInstructions",
  },
  roboformcsv: {
    type: "roboformcsv",
    loaders: [Loader.file],
    instructionKey: "importRoboformInstructions",
  },
  // keepercsv/keeperjson are hidden from the import UI dropdown (superseded by the unified
  // "keeper" entry's Method selector) but remain valid `ImportType`s for non-UI consumers.
  keepercsv: { type: "keepercsv", loaders: [Loader.file] },
  keeperjson: { type: "keeperjson", loaders: [Loader.file] },
  enpasscsv: {
    type: "enpasscsv",
    loaders: [Loader.file],
    instructionKey: "importEnpassCsvInstructions",
  },
  enpassjson: {
    type: "enpassjson",
    loaders: [Loader.file],
    instructionKey: "importEnpassJsonInstructions",
  },
  protonpass: {
    type: "protonpass",
    loaders: [Loader.file],
    instructionKey: "importProtonpassInstructions",
  },
  safeincloudxml: {
    type: "safeincloudxml",
    loaders: [Loader.file],
    instructionKey: "importSafeincloudInstructions",
  },
  pwsafexml: {
    type: "pwsafexml",
    loaders: [Loader.file],
    instructionKey: "importPwsafeInstructions",
  },
  stickypasswordxml: {
    type: "stickypasswordxml",
    loaders: [Loader.file],
    instructionKey: "importStickypasswordInstructions",
  },
  msecurecsv: {
    type: "msecurecsv",
    loaders: [Loader.file],
    instructionKey: "importMsecureInstructions",
  },
  truekeycsv: {
    type: "truekeycsv",
    loaders: [Loader.file],
    instructionKey: "importTruekeyInstructions",
  },
  passwordbossjson: {
    type: "passwordbossjson",
    loaders: [Loader.file],
    instructionKey: "importPasswordbossInstructions",
  },
  // instructions rendered by a dedicated template block: the text is interleaved with a <code>
  // filename, which doesn't fit the flat instructionKey/instructionLink shape.
  zohovaultcsv: { type: "zohovaultcsv", loaders: [Loader.file] },
  splashidcsv: {
    type: "splashidcsv",
    loaders: [Loader.file],
    instructionKey: "importSplashidInstructions",
  },
  passworddragonxml: {
    type: "passworddragonxml",
    loaders: [Loader.file],
    instructionKey: "importPassworddragonInstructions",
  },
  padlockcsv: {
    type: "padlockcsv",
    loaders: [Loader.file],
    instructionKey: "importPadlockInstructions",
  },
  passboltcsv: {
    type: "passboltcsv",
    loaders: [Loader.file],
    instructionKey: "importPassboltInstructions",
  },
  clipperzhtml: {
    type: "clipperzhtml",
    loaders: [Loader.file],
    instructionKey: "importClipperzInstructions",
  },
  aviracsv: {
    type: "aviracsv",
    loaders: [Loader.file],
    instructionKey: "importAviraInstructions",
  },
  saferpasscsv: {
    type: "saferpasscsv",
    loaders: [Loader.file],
    instructionKey: "importSaferpassInstructions",
  },
  upmcsv: { type: "upmcsv", loaders: [Loader.file], instructionKey: "importUpmInstructions" },
  ascendocsv: {
    type: "ascendocsv",
    loaders: [Loader.file],
    instructionKey: "importAscendoInstructions",
  },
  meldiumcsv: {
    type: "meldiumcsv",
    loaders: [Loader.file],
    instructionKey: "importMeldiumInstructions",
  },
  passkeepcsv: {
    type: "passkeepcsv",
    loaders: [Loader.file],
    instructionKey: "importPasskeepInstructions",
  },
  // Arc is Chromium-based (see `getBrowserName`/`getImporter` in import.service.ts) but was
  // missing from this table entirely, so it never rendered any instructions.
  //
  // These 5 siblings link to Chrome's own help article (the process is identical), so
  // `instructionKey` carries only the "same as Chrome" preamble; `sourceName` names Chrome,
  // not the sibling, since that's whose Help Center article the link actually points to.
  arccsv: {
    type: "arccsv",
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  edgecsv: {
    type: "edgecsv",
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  operacsv: {
    type: "operacsv",
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  vivaldicsv: {
    type: "vivaldicsv",
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  bravecsv: {
    type: "bravecsv",
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  // instructions rendered by a dedicated template block: the text is interleaved with a help
  // link and four <code> filenames/commands, which doesn't fit the flat instructionKey/
  // instructionLink shape.
  gnomejson: { type: "gnomejson", loaders: [Loader.file] },
  blurcsv: { type: "blurcsv", loaders: [Loader.file], instructionKey: "importBlurInstructions" },
  passwordagentcsv: {
    type: "passwordagentcsv",
    loaders: [Loader.file],
    instructionKey: "importPasswordagentInstructions",
  },
  passpackcsv: {
    type: "passpackcsv",
    loaders: [Loader.file],
    instructionKey: "importPasspackInstructions",
  },
  passmanjson: {
    type: "passmanjson",
    loaders: [Loader.file],
    instructionKey: "importPassmanInstructions",
  },
  avastcsv: {
    type: "avastcsv",
    loaders: [Loader.file],
    instructionKey: "importAvastCsvInstructions",
  },
  avastjson: {
    type: "avastjson",
    loaders: [Loader.file],
    instructionKey: "importAvastJsonInstructions",
  },
  fsecurefsk: {
    type: "fsecurefsk",
    loaders: [Loader.file],
    instructionKey: "importFsecureInstructions",
  },
  kasperskytxt: {
    type: "kasperskytxt",
    loaders: [Loader.file],
    instructionKey: "importKasperskyInstructions",
  },
  remembearcsv: {
    type: "remembearcsv",
    loaders: [Loader.file],
    instructionKey: "importRemembearInstructions",
  },
  passwordwallettxt: {
    type: "passwordwallettxt",
    loaders: [Loader.file],
    instructionKey: "importPasswordwalletInstructions",
  },
  mykicsv: { type: "mykicsv", loaders: [Loader.file], instructionKey: "importMykiInstructions" },
  securesafecsv: {
    type: "securesafecsv",
    loaders: [Loader.file],
    instructionKey: "importSecuresafeInstructions",
  },
  logmeoncecsv: {
    type: "logmeoncecsv",
    loaders: [Loader.file],
    instructionKey: "importLogmeonceInstructions",
  },
  blackberrycsv: {
    type: "blackberrycsv",
    loaders: [Loader.file],
    instructionKey: "importBlackberryInstructions",
  },
  buttercupcsv: {
    type: "buttercupcsv",
    loaders: [Loader.file],
    instructionKey: "importButtercupInstructions",
  },
  codebookcsv: {
    type: "codebookcsv",
    loaders: [Loader.file],
    instructionKey: "importCodebookInstructions",
  },
  encryptrcsv: {
    type: "encryptrcsv",
    loaders: [Loader.file],
    instructionKey: "importEncryptrInstructions",
  },
  yoticsv: { type: "yoticsv", loaders: [Loader.file], instructionKey: "importYotiInstructions" },
  nordpasscsv: {
    type: "nordpasscsv",
    loaders: [Loader.file],
    instructionKey: "importNordpassInstructions",
  },
  psonojson: {
    type: "psonojson",
    loaders: [Loader.file],
    instructionKey: "importPsonoInstructions",
  },
  passkyjson: {
    type: "passkyjson",
    loaders: [Loader.file],
    instructionKey: "importPasskyInstructions",
  },
  passwordxpcsv: {
    type: "passwordxpcsv",
    loaders: [Loader.file],
    instructionKey: "importPasswordxpInstructions",
  },
  netwrixpasswordsecure: {
    type: "netwrixpasswordsecure",
    loaders: [Loader.file],
    instructionKey: "importNetwrixInstructions",
  },
  passworddepot17xml: {
    type: "passworddepot17xml",
    loaders: [Loader.file],
    instructionKey: "importPassworddepot17Instructions",
  },
  delineaxml: {
    type: "delineaxml",
    loaders: [Loader.file],
    instructionKey: "importDelineaInstructions",
  },
  delineacsv: {
    type: "delineacsv",
    loaders: [Loader.file],
    instructionKey: "importDelineaCsvInstructions",
  },
});
