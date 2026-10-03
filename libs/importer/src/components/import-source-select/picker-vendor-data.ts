import { ImportType } from "../../models";

// Which ids the picker shows a card for, and what to call each one. An id with no entry here
// simply isn't shown — legacy duplicates and non-primary format variants (e.g. 1Password's
// 1pif/wincsv/maccsv) are absent, not filtered out elsewhere.
interface PickerVendorData {
  /** e.g. "Dashlane" — not ImportOption.name's "Dashlane (csv)". */
  displayName: string;
  /** Sibling ImportTypes this same vendor can also produce (e.g. 1Password's 1pux/1pif/win-csv/
   *  mac-csv). Only same-vendor formats belong here — KeePassX is a different product, not a
   *  KeePass format, so it stays out of keepass2xml's list. */
  formats?: readonly ImportType[];
}

const PICKER_VENDOR_DATA: Partial<Record<ImportType, PickerVendorData>> = {
  bitwardenjson: { displayName: "Bitwarden", formats: ["bitwardenjson", "bitwardencsv"] },
  chromecsv: { displayName: "Chrome" },
  dashlanecsv: { displayName: "Dashlane", formats: ["dashlanecsv", "dashlanejson"] },
  firefoxcsv: { displayName: "Firefox" },
  keepass2xml: { displayName: "KeePass", formats: ["keepass2xml", "keepasskdbx"] },
  keepassxcsv: { displayName: "KeePassX" },
  // No bare "keeper" entry in this list: that id is the direct-import pseudo-format, not a file
  // format `ImportService.getImporter` can parse — only "keepercsv"/"keeperjson" have importers.
  keeper: { displayName: "Keeper", formats: ["keepercsv", "keeperjson"] },
  lastpasscsv: { displayName: "LastPass" },
  safaricsv: { displayName: "Safari" },
  "1password1pux": {
    displayName: "1Password",
    formats: ["1password1pux", "1password1pif", "1passwordwincsv", "1passwordmaccsv"],
  },
  roboformcsv: { displayName: "RoboForm" },
  enpasscsv: { displayName: "Enpass", formats: ["enpasscsv", "enpassjson"] },
  protonpass: { displayName: "Proton Pass" },
  safeincloudxml: { displayName: "SafeInCloud" },
  pwsafexml: { displayName: "Password Safe" },
  stickypasswordxml: { displayName: "Sticky Password" },
  msecurecsv: { displayName: "mSecure" },
  truekeycsv: { displayName: "True Key" },
  passwordbossjson: { displayName: "Password Boss" },
  zohovaultcsv: { displayName: "Zoho Vault" },
  splashidcsv: { displayName: "SplashID" },
  padlockcsv: { displayName: "Padlock" },
  passboltcsv: { displayName: "Passbolt" },
  clipperzhtml: { displayName: "Clipperz" },
  aviracsv: { displayName: "Avira" },
  saferpasscsv: { displayName: "SaferPass" },
  ascendocsv: { displayName: "Ascendo" },
  passkeepcsv: { displayName: "PassKeep" },
  arccsv: { displayName: "Arc" },
  edgecsv: { displayName: "Edge" },
  operacsv: { displayName: "Opera" },
  vivaldicsv: { displayName: "Vivaldi" },
  bravecsv: { displayName: "Brave" },
  passwordagentcsv: { displayName: "Password Agent" },
  passpackcsv: { displayName: "Passpack" },
  passmanjson: { displayName: "Passman" },
  avastcsv: { displayName: "Avast", formats: ["avastcsv", "avastjson"] },
  fsecurefsk: { displayName: "F-Secure" },
  kasperskytxt: { displayName: "Kaspersky" },
  securesafecsv: { displayName: "SecureSafe" },
  blackberrycsv: { displayName: "BlackBerry" },
  buttercupcsv: { displayName: "Buttercup" },
  codebookcsv: { displayName: "Codebook" },
  yoticsv: { displayName: "Yoti" },
  nordpasscsv: { displayName: "NordPass" },
  psonojson: { displayName: "Psono" },
  passkyjson: { displayName: "Passky" },
  passwordxpcsv: { displayName: "Password XP" },
  netwrixpasswordsecure: { displayName: "Netwrix" },
  passworddepot17xml: { displayName: "Password Depot" },
  delineaxml: { displayName: "Delinea", formats: ["delineaxml", "delineacsv"] },
  gnomejson: { displayName: "GNOME" },
  blurcsv: { displayName: "Blur" },
  remembearcsv: { displayName: "RememBear" },
  mykicsv: { displayName: "Myki" },
  encryptrcsv: { displayName: "Encryptr" },
  passworddragonxml: { displayName: "Password Dragon" },
  upmcsv: { displayName: "Universal Password Manager" },
  meldiumcsv: { displayName: "Meldium" },
  passwordwallettxt: { displayName: "PasswordWallet" },
  logmeoncecsv: { displayName: "LogMeOnce" },
};

// Whether the picker shows a card for this id.
export function isPickerVendor(id: string): boolean {
  // hasOwnProperty, not `in` — `in` walks the prototype chain, so a raw route param like
  // "constructor" or "toString" would otherwise resolve as a "real" vendor.
  return Object.prototype.hasOwnProperty.call(PICKER_VENDOR_DATA, id);
}

// Caller must confirm isPickerVendor(id) first — the ! assumes an entry exists.
export function pickerDisplayNameFor(id: string): string {
  return PICKER_VENDOR_DATA[id as ImportType]!.displayName;
}

// Every ImportType this vendor's card can produce. Used by ImportControlsComponent to union
// accepted file types and resolve which format an uploaded file belongs to.
export function pickerFormatsFor(id: string): readonly ImportType[] {
  return PICKER_VENDOR_DATA[id as ImportType]?.formats ?? [id as ImportType];
}

/** Display order for the Browsers section */
export const PICKER_BROWSER_ORDER: readonly ImportType[] = [
  "chromecsv",
  "safaricsv",
  "firefoxcsv",
  "edgecsv",
  "bravecsv",
  "operacsv",
  "vivaldicsv",
  "arccsv",
];

/** Display order for the featured Password managers section */
export const PICKER_FEATURED_PASSWORD_MANAGER_ORDER: readonly ImportType[] = [
  "1password1pux",
  "dashlanecsv",
  "keepass2xml",
  "keeper",
  "lastpasscsv",
  "protonpass",
  "nordpasscsv",
  "roboformcsv",
];

// Derived from PICKER_FEATURED_PASSWORD_MANAGER_ORDER instead of a separate flag — membership and
// position are the same fact.
export function isFeaturedPasswordManager(id: string): boolean {
  return (PICKER_FEATURED_PASSWORD_MANAGER_ORDER as readonly string[]).includes(id);
}

// Sorts by position in `order`; ids absent from `order` sort last, in their original order.
export function sortByPickerOrder<T extends { id: string }>(
  items: readonly T[],
  order: readonly ImportType[],
): T[] {
  const rank = new Map<string, number>(order.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length),
  );
}
