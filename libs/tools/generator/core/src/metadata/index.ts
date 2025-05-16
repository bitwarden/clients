import {
  Algorithm as AlgorithmData,
  AlgorithmsByType as AlgorithmsByTypeData,
  Type as TypeData,
} from "./data";
import catchall from "./email/catchall";
import plusAddress from "./email/plus-address";
import passphrase from "./password/eff-word-list";
import password from "./password/random-password";
import { CredentialType, CredentialAlgorithm } from "./type";
import effWordList from "./username/eff-word-list";

/** Credential generators hosted natively by the credential generator system.
 *  These are supplemented by generators from the {@link ExtensionService}.
 */
export const BuiltIn = Object.freeze({
  /** Catchall email address generator */
  catchall,

  /** plus-addressed email address generator */
  plusAddress,

  /** passphrase generator using the EFF word list */
  passphrase,

  /** password generator */
  password,

  /** username generator using the EFF word list */
  effWordList,
});

// `CredentialAlgorithm` is defined in terms of `ABT`; supplying
// type information in the barrel file breaks a circular dependency.
/** Credential generation algorithms grouped by purpose. */
export const AlgorithmsByType: Record<
  CredentialType,
  ReadonlyArray<CredentialAlgorithm>
> = AlgorithmsByTypeData;

/** A list of all built-in algorithm identifiers
 *  @remarks this is useful when you need to filter invalid values
 */
export const Algorithms: ReadonlyArray<CredentialAlgorithm> = Object.freeze(
  Object.values(AlgorithmData),
);

/** A list of all built-in algorithm types
 *  @remarks this is useful when you need to filter invalid values
 */
export const Types: ReadonlyArray<CredentialType> = Object.freeze(Object.values(TypeData));

export { Profile, Type, Algorithm } from "./data";
export { toForwarderMetadata } from "./email/forwarder";
export { AlgorithmMetadata } from "./algorithm-metadata";
export { GeneratorMetadata } from "./generator-metadata";
export { ProfileContext, CoreProfileMetadata, ProfileMetadata } from "./profile-metadata";
export {
  GeneratorProfile,
  CredentialAlgorithm,
  PasswordAlgorithm,
  CredentialType,
  ForwarderExtensionId,
} from "./type";
export { isForwarderProfile, toVendorId, isForwarderExtensionId } from "./util";
