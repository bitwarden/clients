// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

/**
 * A single Netwrix Password Secure CSV row.
 *
 * Netwrix exports the same logical field under different column headers depending on the
 * export's language and version (and, for script-generated exports, whatever the script emits).
 * All known header variants for a given field are listed here so the importer can map any of them.
 */
export class LoginRecord {
  /** Organization unit / folder / collection */
  Organisationseinheit: string;
  "Organisational unit": string;
  /** Tags? */
  DataTags: string;
  /** Description/title */
  Beschreibung: string;
  /** Username */
  Benutzername: string;
  /** Password */
  Passwort: string;
  /** URL — Netwrix uses different header names depending on the export's language/version */
  Internetseite: string;
  Internetadresse: string;
  Webseite: string;
  Webseite1: string;
  Website: string;
  Webmail: string;
  "Web page": string;
  URL: string;
  /** Email address */
  "EMail-Adresse": string;
  /** Notes/additional information */
  Informationen: string;
  Kommentare: string;
  /** TOTP */
  "One-Time Passwort": string;
}
