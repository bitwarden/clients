export interface ImportOption {
  id: string;
  name: string;
}

export const featuredImportOptions = [
  { id: "bitwardenjson", name: "Bitwarden (json)" },
  { id: "bitwardencsv", name: "Bitwarden (csv)" },
  { id: "chromecsv", name: "Chrome (csv)" },
  { id: "dashlanecsv", name: "Dashlane (csv)" },
  { id: "firefoxcsv", name: "Firefox (csv)" },
  { id: "keepass2xml", name: "KeePass 2 (xml)" },
  { id: "lastpasscsv", name: "LastPass" },
  { id: "safaricsv", name: "Safari and macOS (csv)" },
  { id: "1password1pux", name: "1Password (1pux/json)" },
] as const;

export const regularImportOptions = [
  { id: "keepassxcsv", name: "KeePassX (csv)" },
  { id: "1password1pif", name: "1Password (1pif)" },
  { id: "1passwordwincsv", name: "1Password 6 and 7 Windows (csv)" },
  { id: "1passwordmaccsv", name: "1Password 6 and 7 Mac (csv)" },
  { id: "dashlanejson", name: "Dashlane (json)" },
  { id: "roboformcsv", name: "RoboForm (csv)" },
  { id: "keepercsv", name: "Keeper (csv)" },
  // Temporarily remove this option for the Feb release
  // { id: "keeperjson", name: "Keeper (json)" },
  { id: "enpasscsv", name: "Enpass (csv)" },
  { id: "enpassjson", name: "Enpass (json)" },
  { id: "protonpass", name: "ProtonPass (zip/json)" },
  { id: "safeincloudxml", name: "SafeInCloud (xml)" },
  { id: "pwsafexml", name: "Password Safe - pwsafe.org (xml)" },
  { id: "stickypasswordxml", name: "Sticky Password (xml)" },
  { id: "msecurecsv", name: "mSecure (csv)" },
  { id: "truekeycsv", name: "True Key (csv)" },
  { id: "passwordbossjson", name: "Password Boss (json)" },
  { id: "zohovaultcsv", name: "Zoho Vault (csv)" },
  { id: "splashidcsv", name: "SplashID (csv)" },
  { id: "passworddragonxml", name: "Password Dragon (xml)" },
  { id: "padlockcsv", name: "Padlock (csv)" },
  { id: "passboltcsv", name: "Passbolt (csv)" },
  { id: "clipperzhtml", name: "Clipperz (html)" },
  { id: "aviracsv", name: "Avira (csv)" },
  { id: "saferpasscsv", name: "SaferPass (csv)" },
  { id: "upmcsv", name: "Universal Password Manager (csv)" },
  { id: "ascendocsv", name: "Ascendo DataVault (csv)" },
  { id: "meldiumcsv", name: "Meldium (csv)" },
  { id: "passkeepcsv", name: "PassKeep (csv)" },
  { id: "operacsv", name: "Opera (csv)" },
  { id: "vivaldicsv", name: "Vivaldi (csv)" },
  { id: "gnomejson", name: "GNOME Passwords and Keys/Seahorse (json)" },
  { id: "blurcsv", name: "Blur (csv)" },
  { id: "passwordagentcsv", name: "Password Agent (csv)" },
  { id: "passpackcsv", name: "Passpack (csv)" },
  { id: "passmanjson", name: "Passman (json)" },
  { id: "avastcsv", name: "Avast Passwords (csv)" },
  { id: "avastjson", name: "Avast Passwords (json)" },
  { id: "fsecurefsk", name: "F-Secure KEY (fsk)" },
  { id: "kasperskytxt", name: "Kaspersky Password Manager (txt)" },
  { id: "remembearcsv", name: "RememBear (csv)" },
  { id: "passwordwallettxt", name: "PasswordWallet (txt)" },
  { id: "mykicsv", name: "Myki (csv)" },
  { id: "securesafecsv", name: "SecureSafe (csv)" },
  { id: "logmeoncecsv", name: "LogMeOnce (csv)" },
  { id: "blackberrycsv", name: "BlackBerry Password Keeper (csv)" },
  { id: "buttercupcsv", name: "Buttercup (csv)" },
  { id: "codebookcsv", name: "Codebook (csv)" },
  { id: "encryptrcsv", name: "Encryptr (csv)" },
  { id: "yoticsv", name: "Yoti (csv)" },
  { id: "nordpasscsv", name: "Nordpass (csv)" },
  { id: "psonojson", name: "Psono (json)" },
  { id: "passkyjson", name: "Passky (json)" },
  { id: "passwordxpcsv", name: "Password XP (csv)" },
  { id: "netwrixpasswordsecure", name: "Netwrix Password Secure (csv)" },
] as const;

export type ImportType =
  | (typeof featuredImportOptions)[number]["id"]
  | (typeof regularImportOptions)[number]["id"];
