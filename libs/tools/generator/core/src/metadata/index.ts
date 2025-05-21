import {
  Algorithm as AlgorithmData,
  AlgorithmsByType as AlgorithmsByTypeData,
  Type as TypeData,
} from "./data";
import { CredentialType, CredentialAlgorithm } from "./type";

// `CredentialAlgorithm` is defined in terms of `ABT`; supplying
// type information in the barrel file breaks a circular dependency.
/** Credential generation algorithms grouped by purpose. */
export const AlgorithmsByType: Record<
  CredentialType,
  ReadonlyArray<CredentialAlgorithm>
> = AlgorithmsByTypeData;
export const Algorithms: ReadonlyArray<CredentialAlgorithm> = Object.freeze(
  Object.values(AlgorithmData),
);
export const Types: ReadonlyArray<CredentialType> = Object.freeze(Object.values(TypeData));

export { Profile, Type, Algorithm } from "./data";
export { toForwarderMetadata } from "./email/forwarder";
export { GeneratorMetadata } from "./generator-metadata";
export { ProfileContext, CoreProfileMetadata, ProfileMetadata } from "./profile-metadata";
export { GeneratorProfile, CredentialAlgorithm, CredentialType } from "./type";
export { isForwarderProfile, toVendorId, isForwarderExtensionId } from "./util";
