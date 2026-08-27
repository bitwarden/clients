import {
  BitSvg,
  BitwardenIcon,
  Import1PasswordIcon,
  ImportArcIcon,
  ImportAscendoIcon,
  ImportAvastIcon,
  ImportAviraIcon,
  ImportBlackberryIcon,
  ImportBraveIcon,
  ImportButtercupIcon,
  ImportChromeIcon,
  ImportClipperzIcon,
  ImportCodebookIcon,
  ImportDashlaneIcon,
  ImportEdgeIcon,
  ImportEnpassIcon,
  ImportFSecureIcon,
  ImportFirefoxIcon,
  ImportKasperskyIcon,
  ImportKeepassIcon,
  ImportKeeperIcon,
  ImportLastpassIcon,
  ImportLogmeonceIcon,
  ImportMsecureIcon,
  ImportNetwrixIcon,
  ImportNordpassIcon,
  ImportOperaIcon,
  ImportPadlockIcon,
  ImportPassboltIcon,
  ImportPasskeepIcon,
  ImportPasskyIcon,
  ImportPassmanIcon,
  ImportPasspackIcon,
  ImportPasswordAgentIcon,
  ImportPasswordBossIcon,
  ImportPasswordDepotIcon,
  ImportPasswordSafeIcon,
  ImportPasswordXpIcon,
  ImportProtonpassIcon,
  ImportPsonoIcon,
  ImportRoboformIcon,
  ImportSafariIcon,
  ImportSafeincloudIcon,
  ImportSaferpassIcon,
  ImportSecuresafeIcon,
  ImportSplashidIcon,
  ImportStickyPasswordIcon,
  ImportTruekeyIcon,
  ImportVivaldiIcon,
  ImportYotiIcon,
  ImportZohoIcon,
} from "@bitwarden/assets/svg";

import { ImportType } from "../../models";

/** Picker-only presentation data per vendor, keyed here (in the UI layer) rather than on
 *  `ImportOption` itself, so importing vendor metadata (`@bitwarden/importer-core`, used by the
 *  CLI) never pulls in icon assets or picker-specific copy. Only consumers that actually render
 *  `ImportSourceSelectComponent` pay for this.
 *
 *  This table is also the single source of truth for which ids the picker shows at all: an id
 *  with no entry here — a legacy duplicate (Keeper's old `keepercsv`/`keeperjson`) or a
 *  non-primary format variant of an already-represented vendor (e.g. 1Password's `1password1pif`,
 *  `1passwordwincsv`, `1passwordmaccsv` — all four accepted formats resolve to one "1Password"
 *  card) — is simply absent, not separately tracked and filtered out. `ImportOption.name` keeps
 *  every variant for the CLI and the existing format dropdown (`ImportComponent`); this table
 *  only controls the picker's one-card-per-vendor grid. */
interface PickerVendorMetadata {
  /** Vendor logo. Absent ids fall back to a generic icon tile in the picker. */
  icon?: BitSvg;
  /** Clean vendor name for the picker's one-card-per-vendor grid — e.g. "Dashlane", not
   *  `ImportOption.name`'s "Dashlane (csv)". `ImportOption.name` keeps its format/version suffix
   *  for the CLI and the existing format dropdown.  */
  displayName: string;
}

const PICKER_VENDOR_METADATA: Partial<Record<ImportType, PickerVendorMetadata>> = {
  bitwardenjson: { icon: BitwardenIcon, displayName: "Bitwarden" },
  chromecsv: { icon: ImportChromeIcon, displayName: "Chrome" },
  dashlanecsv: { icon: ImportDashlaneIcon, displayName: "Dashlane" },
  firefoxcsv: { icon: ImportFirefoxIcon, displayName: "Firefox" },
  keepass2xml: { icon: ImportKeepassIcon, displayName: "KeePass" },
  keepassxcsv: { icon: ImportKeepassIcon, displayName: "KeePassX" },
  keeper: { icon: ImportKeeperIcon, displayName: "Keeper" },
  lastpasscsv: { icon: ImportLastpassIcon, displayName: "LastPass" },
  safaricsv: { icon: ImportSafariIcon, displayName: "Safari" },
  "1password1pux": { icon: Import1PasswordIcon, displayName: "1Password" },
  roboformcsv: { icon: ImportRoboformIcon, displayName: "RoboForm" },
  enpasscsv: { icon: ImportEnpassIcon, displayName: "Enpass" },
  protonpass: { icon: ImportProtonpassIcon, displayName: "Proton Pass" },
  safeincloudxml: { icon: ImportSafeincloudIcon, displayName: "SafeInCloud" },
  pwsafexml: { icon: ImportPasswordSafeIcon, displayName: "Password Safe" },
  stickypasswordxml: { icon: ImportStickyPasswordIcon, displayName: "Sticky Password" },
  msecurecsv: { icon: ImportMsecureIcon, displayName: "mSecure" },
  truekeycsv: { icon: ImportTruekeyIcon, displayName: "True Key" },
  passwordbossjson: { icon: ImportPasswordBossIcon, displayName: "Password Boss" },
  zohovaultcsv: { icon: ImportZohoIcon, displayName: "Zoho Vault" },
  splashidcsv: { icon: ImportSplashidIcon, displayName: "SplashID" },
  padlockcsv: { icon: ImportPadlockIcon, displayName: "Padlock" },
  passboltcsv: { icon: ImportPassboltIcon, displayName: "Passbolt" },
  clipperzhtml: { icon: ImportClipperzIcon, displayName: "Clipperz" },
  aviracsv: { icon: ImportAviraIcon, displayName: "Avira" },
  saferpasscsv: { icon: ImportSaferpassIcon, displayName: "SaferPass" },
  ascendocsv: { icon: ImportAscendoIcon, displayName: "Ascendo" },
  passkeepcsv: { icon: ImportPasskeepIcon, displayName: "PassKeep" },
  arccsv: { icon: ImportArcIcon, displayName: "Arc" },
  edgecsv: { icon: ImportEdgeIcon, displayName: "Edge" },
  operacsv: { icon: ImportOperaIcon, displayName: "Opera" },
  vivaldicsv: { icon: ImportVivaldiIcon, displayName: "Vivaldi" },
  bravecsv: { icon: ImportBraveIcon, displayName: "Brave" },
  passwordagentcsv: { icon: ImportPasswordAgentIcon, displayName: "Password Agent" },
  passpackcsv: { icon: ImportPasspackIcon, displayName: "Passpack" },
  passmanjson: { icon: ImportPassmanIcon, displayName: "Passman" },
  avastcsv: { icon: ImportAvastIcon, displayName: "Avast" },
  fsecurefsk: { icon: ImportFSecureIcon, displayName: "F-Secure" },
  kasperskytxt: { icon: ImportKasperskyIcon, displayName: "Kaspersky" },
  securesafecsv: { icon: ImportSecuresafeIcon, displayName: "SecureSafe" },
  logmeoncecsv: { icon: ImportLogmeonceIcon, displayName: "LogMeOnce" },
  blackberrycsv: { icon: ImportBlackberryIcon, displayName: "BlackBerry" },
  buttercupcsv: { icon: ImportButtercupIcon, displayName: "Buttercup" },
  codebookcsv: { icon: ImportCodebookIcon, displayName: "Codebook" },
  yoticsv: { icon: ImportYotiIcon, displayName: "Yoti" },
  nordpasscsv: { icon: ImportNordpassIcon, displayName: "NordPass" },
  psonojson: { icon: ImportPsonoIcon, displayName: "Psono" },
  passkyjson: { icon: ImportPasskyIcon, displayName: "Passky" },
  passwordxpcsv: { icon: ImportPasswordXpIcon, displayName: "Password XP" },
  netwrixpasswordsecure: { icon: ImportNetwrixIcon, displayName: "Netwrix" },
  passworddepot17xml: { icon: ImportPasswordDepotIcon, displayName: "Password Depot" },
  delineaxml: { displayName: "Delinea" },

  // No vendor art supplied for these — generic icon tile, vendor-only name still required.
  passworddragonxml: { displayName: "Password Dragon" },
  upmcsv: { displayName: "Universal Password Manager" },
  meldiumcsv: { displayName: "Meldium" },
  gnomejson: { displayName: "GNOME Passwords and Keys" },
  blurcsv: { displayName: "Blur" },
  remembearcsv: { displayName: "RememBear" },
  passwordwallettxt: { displayName: "PasswordWallet" },
  mykicsv: { displayName: "Myki" },
  encryptrcsv: { displayName: "Encryptr" },
};

export function pickerIconFor(id: string): BitSvg | undefined {
  return PICKER_VENDOR_METADATA[id as ImportType]?.icon;
}

/** Only ever called for ids the caller has already confirmed with `isPickerVendor` — the picker
 *  never has a card to put a raw `ImportOption.name` fallback on in the first place. */
export function pickerDisplayNameFor(id: string): string {
  return PICKER_VENDOR_METADATA[id as ImportType]!.displayName;
}

/** Whether `ImportSourceSelectComponent`'s grid shows a card for this id at all. Every vendor the
 *  picker displays has an entry in `PICKER_VENDOR_METADATA`; ids with none — legacy duplicates,
 *  non-primary format variants — are simply absent from it, not separately tracked as hidden. */
export function isPickerVendor(id: string): boolean {
  return id in PICKER_VENDOR_METADATA;
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

/** Sorts `ids` by their position in `order`; anything absent from `order` sorts after everything
 *  present, in its original relative order. Used to pin the Browsers/featured Password managers
 *  sections to the design's order instead of `ImportOption`'s declaration order in the
 *  CLI-shared data file, which carries no intentional display sequence. */
export function sortByPickerOrder<T extends { id: string }>(
  items: readonly T[],
  order: readonly ImportType[],
): T[] {
  const rank = new Map<string, number>(order.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length),
  );
}
