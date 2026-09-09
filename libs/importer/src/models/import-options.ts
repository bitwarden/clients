import { deepFreeze } from "@bitwarden/common/tools/util";

import { DataLoader, Loader } from "../metadata/data";
import { CredentialKind } from "../sdk/credential-kind";

/** Central record of what's known about each vendor/format */
export interface ImportOption {
  /** Identifies the importer */
  id: string;

  /** Normalized display name shown in the format dropdown */
  name: string;

  /** Shown in the dropdown's featured section, above the alphabetical regular list */
  featuredImporter: boolean;

  /** True for a browser's native export (Chrome, Edge, Opera, Vivaldi, Brave, Firefox, Safari,
   *  Arc, and any other Chromium-family sibling); false for every password manager / other
   *  import. */
  isBrowser: boolean;

  /** File extensions (no leading dot) this format's importer accepts */
  acceptedFileTypes: readonly string[];

  /** Subset of acceptedFileTypes that can also be pasted as plaintext into the textarea */
  pasteFormats: readonly string[];

  /** Whether a direct/API-based import mode exists for this vendor, in addition to file import */
  hasDirectImporter: boolean;

  /** Describes the strategies used to obtain imported data; baseline for clients that don't
   *  do their own runtime detection. Desktop overrides this per machine — see
   *  DesktopImportMetadataService. */
  loaders: readonly DataLoader[];

  /** Set when this format's parse/encrypt/submit is handled by an SDK importer strategy (see
   *  `SdkImporterRegistry`) instead of the classic client-side `Importer` pipeline. */
  sdk?: {
    /** File extensions (no leading dot, same convention as `acceptedFileTypes`) the SDK
     *  importer accepts. */
    fileTypes: readonly string[];
    /** The credentials the entry points must collect before invoking the SDK import. */
    credentialKind: CredentialKind;
  };

  /** i18n key for the importer's step-by-step help-text instructions shown in the import UI */
  instructionKey?: string;

  /** Static help URL for the importer's Help Center article, if any */
  instructionLink?: string;

  /** Clean vendor name interpolated into the generic "See detailed $NAME$ instructions
   *  in our Help Center" sentence shown when `instructionLink` is set */
  sourceName?: string;
}

/** Every field of `ImportOption` except `id` — `id` is the key in `importOptionsById` below, so
 *  storing it again inside each value would be a second, hand-maintained copy of the same fact
 *  with nothing to keep them in sync. `importOptions` (derived below) attaches `id` from the key
 *  for consumers that need a plain array of full `ImportOption` objects. */
export type ImportOptionData = Omit<ImportOption, "id">;

const bitwardenExportHelp = "https://bitwarden.com/help/export-your-data/";
const chromeImportHelp = "https://bitwarden.com/help/import-from-chrome/";

/** Every supported importer, keyed by id. This is the canonical, exhaustively-checked source —
 *  `ImportType` is derived from its keys, and `importOptions` (the ordered array the dropdown
 *  and CLI use) is derived from its entries. */
export const importOptionsById = deepFreeze({
  bitwardenjson: {
    name: "Bitwarden (json)",
    featuredImporter: true,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "Bitwarden",
    instructionLink: bitwardenExportHelp,
  },
  bitwardencsv: {
    name: "Bitwarden (csv)",
    featuredImporter: true,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "Bitwarden",
    instructionLink: bitwardenExportHelp,
  },
  // `loaders` here is `[Loader.file]` for chromecsv and every other Chromium-family entry
  // below, deliberately: this static baseline is what web/browser/cli see. On Desktop,
  // chromecsv gets `Loader.chromium` merged in at runtime exactly like its siblings, when
  // Chrome itself is detected as installed — it is not excluded from that detection.
  chromecsv: {
    name: "Chrome",
    featuredImporter: true,
    isBrowser: true,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: true,
    loaders: [Loader.file],
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  dashlanecsv: {
    name: "Dashlane (csv)",
    featuredImporter: true,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importDashlaneCsvInstructions",
  },
  firefoxcsv: {
    name: "Firefox (csv)",
    featuredImporter: true,
    isBrowser: true,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "Firefox",
    instructionLink: "https://bitwarden.com/help/import-from-firefox/",
  },
  keepass2xml: {
    name: "KeePass 2 (xml)",
    featuredImporter: true,
    isBrowser: false,
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importKeepass2Instructions",
  },
  // Keeper and LastPass (below) each also have a "direct" import mode — authenticate to the
  // vendor's own API, fetch, decrypt client-side in memory — gated by a standalone ClientType
  // check (ImportKeeperComponent for Keeper; the showLastPassToggle getter on ImportComponent
  // itself for LastPass) rather than by `loaders`. `hasDirectImporter` reflects that mode;
  // `loaders` only covers the file/CSV fallback both vendors also support; no `Loader` value
  // describes the direct mode itself (see metadata/data.ts).
  keeper: {
    name: "Keeper",
    featuredImporter: true,
    isBrowser: false,
    acceptedFileTypes: ["csv", "json"],
    pasteFormats: ["csv", "json"],
    hasDirectImporter: true,
    loaders: [Loader.file],
    sourceName: "Keeper",
    instructionLink: "https://bitwarden.com/help/import-from-keeper/",
  },
  lastpasscsv: {
    name: "LastPass",
    featuredImporter: true,
    isBrowser: false,
    // LastPass can also export as an HTML file; import.component.ts's getFileContents extracts
    // the CSV data from a <pre> tag when the uploaded file is text/html.
    acceptedFileTypes: ["csv", "html"],
    pasteFormats: ["csv"],
    hasDirectImporter: true,
    loaders: [Loader.file],
    sourceName: "LastPass",
    instructionLink: "https://bitwarden.com/help/import-from-lastpass/",
  },
  safaricsv: {
    name: "Safari and macOS (csv)",
    featuredImporter: true,
    isBrowser: true,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "Safari",
    instructionLink: "https://bitwarden.com/help/import-from-safari/",
  },
  "1password1pux": {
    name: "1Password (1pux/json)",
    featuredImporter: true,
    isBrowser: false,
    // .1pux is a zip container, unzipped to json before parsing — but import.component.ts's
    // getFileContents only unzips when the file is actually a .1pux; a plain .json export for
    // this format falls through untouched to parse(), so json is a real accepted/pasteable
    // input too.
    acceptedFileTypes: ["1pux", "json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  keepasskdbx: {
    name: "KeePass (kdbx)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["kdbx"],
    pasteFormats: [],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sdk: { fileTypes: ["kdbx"], credentialKind: CredentialKind.passwordWithKeyFile },
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
    instructionKey: "importKeepassxInstructions",
  },
  "1password1pif": {
    name: "1Password (1pif)",
    featuredImporter: false,
    isBrowser: false,
    // 1PIF is newline-delimited JSON lines, not a zip container — genuinely plain text.
    acceptedFileTypes: ["1pif"],
    pasteFormats: ["1pif"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  "1passwordwincsv": {
    name: "1Password 6 and 7 Windows (csv)",
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
    name: "1Password 6 and 7 Mac (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  },
  dashlanejson: {
    name: "Dashlane (json)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importDashlaneJsonInstructions",
  },
  roboformcsv: {
    name: "RoboForm (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importRoboformInstructions",
  },
  // keepercsv/keeperjson are hidden from the import UI dropdown (superseded by the unified
  // "keeper" entry's Method selector) but remain valid ids for non-UI consumers (CLI).
  keepercsv: {
    name: "Keeper (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
  },
  keeperjson: {
    name: "Keeper (json)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
  },
  enpasscsv: {
    name: "Enpass (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importEnpassCsvInstructions",
  },
  enpassjson: {
    name: "Enpass (json)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importEnpassJsonInstructions",
  },
  protonpass: {
    name: "ProtonPass (zip/json)",
    featuredImporter: false,
    isBrowser: false,
    // .zip is unzipped to json before parsing, but import.component.ts's getFileContents only
    // unzips when the file is actually a zip; a plain .json export falls through untouched to
    // parse(), so json is a real accepted/pasteable input too.
    acceptedFileTypes: ["zip", "json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importProtonpassInstructions",
  },
  safeincloudxml: {
    name: "SafeInCloud (xml)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importSafeincloudInstructions",
  },
  pwsafexml: {
    name: "Password Safe - pwsafe.org (xml)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPwsafeInstructions",
  },
  stickypasswordxml: {
    name: "Sticky Password (xml)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importStickypasswordInstructions",
  },
  msecurecsv: {
    name: "mSecure (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importMsecureInstructions",
  },
  truekeycsv: {
    name: "True Key (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importTruekeyInstructions",
  },
  passwordbossjson: {
    name: "Password Boss (json)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPasswordbossInstructions",
  },
  // instructions rendered by a dedicated template block: the text is interleaved with a <code>
  // filename, which doesn't fit the flat instructionKey/instructionLink shape.
  zohovaultcsv: {
    name: "Zoho Vault (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
  },
  splashidcsv: {
    name: "SplashID (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importSplashidInstructions",
  },
  passworddragonxml: {
    name: "Password Dragon (xml)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPassworddragonInstructions",
  },
  padlockcsv: {
    name: "Padlock (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPadlockInstructions",
  },
  passboltcsv: {
    name: "Passbolt (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPassboltInstructions",
  },
  clipperzhtml: {
    name: "Clipperz (html)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["html"],
    pasteFormats: ["html"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importClipperzInstructions",
  },
  aviracsv: {
    name: "Avira (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importAviraInstructions",
  },
  saferpasscsv: {
    name: "SaferPass (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importSaferpassInstructions",
  },
  upmcsv: {
    name: "Universal Password Manager (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importUpmInstructions",
  },
  ascendocsv: {
    name: "Ascendo DataVault (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importAscendoInstructions",
  },
  meldiumcsv: {
    name: "Meldium (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importMeldiumInstructions",
  },
  passkeepcsv: {
    name: "PassKeep (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPasskeepInstructions",
  },
  // Arc is Chromium-based (see `getBrowserName`/`getImporter` in import.service.ts) but was
  // missing from the old metadata table entirely, so it never rendered any instructions.
  //
  // These 5 siblings link to Chrome's own help article (the process is identical), so
  // `instructionKey` carries only the "same as Chrome" preamble; `sourceName` names Chrome,
  // not the sibling, since that's whose Help Center article the link actually points to.
  arccsv: {
    name: "Arc",
    featuredImporter: false,
    isBrowser: true,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: true,
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  edgecsv: {
    name: "Edge",
    featuredImporter: false,
    isBrowser: true,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: true,
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  operacsv: {
    name: "Opera",
    featuredImporter: false,
    isBrowser: true,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: true,
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  vivaldicsv: {
    name: "Vivaldi",
    featuredImporter: false,
    isBrowser: true,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: true,
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  bravecsv: {
    name: "Brave",
    featuredImporter: false,
    isBrowser: true,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: true,
    loaders: [Loader.file],
    instructionKey: "importChromiumAliasPreamble",
    sourceName: "Chrome",
    instructionLink: chromeImportHelp,
  },
  // instructions rendered by a dedicated template block: the text is interleaved with a help
  // link and four <code> filenames/commands, which doesn't fit the flat instructionKey/
  // instructionLink shape.
  gnomejson: {
    name: "GNOME Passwords and Keys/Seahorse (json)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
  },
  blurcsv: {
    name: "Blur (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importBlurInstructions",
  },
  passwordagentcsv: {
    name: "Password Agent (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPasswordagentInstructions",
  },
  passpackcsv: {
    name: "Passpack (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPasspackInstructions",
  },
  passmanjson: {
    name: "Passman (json)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPassmanInstructions",
  },
  avastcsv: {
    name: "Avast Passwords (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importAvastCsvInstructions",
  },
  avastjson: {
    name: "Avast Passwords (json)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importAvastJsonInstructions",
  },
  fsecurefsk: {
    name: "F-Secure KEY (fsk)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["fsk"],
    pasteFormats: ["fsk"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importFsecureInstructions",
  },
  kasperskytxt: {
    name: "Kaspersky Password Manager (txt)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["txt"],
    pasteFormats: ["txt"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importKasperskyInstructions",
  },
  remembearcsv: {
    name: "RememBear (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importRemembearInstructions",
  },
  passwordwallettxt: {
    name: "PasswordWallet (txt)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["txt"],
    pasteFormats: ["txt"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPasswordwalletInstructions",
  },
  mykicsv: {
    name: "Myki (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importMykiInstructions",
  },
  securesafecsv: {
    name: "SecureSafe (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importSecuresafeInstructions",
  },
  logmeoncecsv: {
    name: "LogMeOnce (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importLogmeonceInstructions",
  },
  blackberrycsv: {
    name: "BlackBerry Password Keeper (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importBlackberryInstructions",
  },
  buttercupcsv: {
    name: "Buttercup (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importButtercupInstructions",
  },
  codebookcsv: {
    name: "Codebook (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importCodebookInstructions",
  },
  encryptrcsv: {
    name: "Encryptr (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importEncryptrInstructions",
  },
  yoticsv: {
    name: "Yoti (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importYotiInstructions",
  },
  nordpasscsv: {
    name: "Nordpass (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importNordpassInstructions",
  },
  psonojson: {
    name: "Psono (json)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPsonoInstructions",
  },
  passkyjson: {
    name: "Passky (json)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPasskyInstructions",
  },
  passwordxpcsv: {
    name: "Password XP (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPasswordxpInstructions",
  },
  netwrixpasswordsecure: {
    name: "Netwrix Password Secure (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importNetwrixInstructions",
  },
  passworddepot17xml: {
    name: "Password Depot 17 (xml)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importPassworddepot17Instructions",
  },
  delineaxml: {
    name: "Delinea (xml)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importDelineaInstructions",
  },
  delineacsv: {
    name: "Delinea (csv)",
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    instructionKey: "importDelineaCsvInstructions",
  },
} as const satisfies Record<string, ImportOptionData>);

export type ImportType = keyof typeof importOptionsById;

/** Ordered view of `importOptionsById` for iteration (the dropdown, CLI `--formats` listing,
 *  etc.). Order determines dropdown position within each of the featured/regular groups (see
 *  import.component.ts, which filters by `featuredImporter` and sorts the regular group
 *  alphabetically by name). Declaration order above is preserved: `Object.entries` on a
 *  string-keyed object yields insertion order.
 */
export const importOptions: readonly ImportOption[] = Object.entries(importOptionsById).map(
  ([id, option]) => ({ id, ...option }),
);
