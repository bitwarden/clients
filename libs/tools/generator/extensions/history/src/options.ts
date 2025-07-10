/** Kinds of credentials that can be stored by the history service */
export type GeneratorCategory = "password" | "passphrase";

/** Configuration options for the history service */
export type HistoryServiceOptions = {
  /** Total number of records retained across all types.
   *  @remarks Setting this to 0 or less disables history completely.
   * */
  maxTotal: number;
};
