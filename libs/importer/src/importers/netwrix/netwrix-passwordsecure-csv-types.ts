// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class LoginRecord {
  /** Organization unit / folder / collection */
  Organisationseinheit: string;
  /** Tags? */
  DataTags: string;
  /** Description/title */
  Beschreibung: string;
  /** Username */
  Benutzername: string;
  /** Password */
  Passwort: string;
  /** URL */
  Internetseite: string;
  /** Notes/additional information */
  Informationen: string;
  /** TOTP */
  "One-Time Passwort": string;
}
