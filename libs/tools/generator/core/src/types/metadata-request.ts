import { CredentialAlgorithm, CredentialType } from "../metadata";

export type AlgorithmRequest = { algorithm: CredentialAlgorithm };
export type TypeRequest = { type: CredentialType };
export type MetadataRequest = Partial<AlgorithmRequest & TypeRequest>;

export function isAlgorithmRequest(request: MetadataRequest): request is AlgorithmRequest {
  return !!request.algorithm;
}

export function isTypeRequest(request: MetadataRequest): request is TypeRequest {
  return !!request.type;
}
