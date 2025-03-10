import { EmailAlgorithm, PasswordAlgorithm, UsernameAlgorithm } from "./generator-type";

export * from "./boundary";
export * from "./catchall-generator-options";
export * from "./credential-generator";
export * from "./credential-generator-configuration";
export * from "./eff-username-generator-options";
export * from "./forwarder-options";
export * from "./generate-request";
export * from "./generator-constraints";
export * from "./generated-credential";
export * from "./generator-options";
export * from "./generator-type";
export * from "./no-policy";
export * from "./passphrase-generation-options";
export * from "./passphrase-generator-policy";
export * from "./password-generation-options";
export * from "./password-generator-policy";
export * from "./policy-configuration";
export * from "./subaddress-generator-options";
export * from "./word-options";

/** Provided for backwards compatibility only.
 *  @deprecated Use one of the Algorithm types instead.
 */
export type GeneratorType = PasswordAlgorithm | UsernameAlgorithm | EmailAlgorithm;

/** Provided for backwards compatibility only.
 *  @deprecated Use one of the Algorithm types instead.
 */
export type PasswordType = PasswordAlgorithm;
