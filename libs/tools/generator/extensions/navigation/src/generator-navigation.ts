import { GeneratorType, ForwarderId, UsernameGeneratorType } from "@bitwarden/generator-core";

/** Stores credential generator UI state. */
export type GeneratorNavigation = {
  /** The kind of credential being generated.
   * @remarks The legacy generator only supports "password" and "passphrase".
   *  The componentized generator supports all values.
   */
  type?: GeneratorType;

  /** When `type === "username"`, this stores the username algorithm. */
  username?: UsernameGeneratorType;

  /** When `username === "forwarded"`, this stores the forwarder implementation. */
  forwarder?: ForwarderId | "";
};
