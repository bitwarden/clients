import { AlgorithmsByType as ABT } from "./data";
import { CredentialType, CredentialAlgorithm } from "./type";

export const AlgorithmsByType: Record<CredentialType, ReadonlyArray<CredentialAlgorithm>> = ABT;

export { Profile, Type } from "./data";
export { toForwarderMetadata } from "./email/forwarder";
export { GeneratorMetadata } from "./generator-metadata";
export { ProfileContext, CoreProfileMetadata, ProfileMetadata } from "./profile-metadata";
export { GeneratorProfile, CredentialAlgorithm, CredentialType } from "./type";
export { isForwarderProfile, toVendorId, isForwarderExtensionId } from "./util";
