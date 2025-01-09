import {
  CreateCredentialParams,
  CreateCredentialResult,
  AssertCredentialParams,
  AssertCredentialResult,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";

export enum MessageType {
  CredentialCreationRequest,
  CredentialCreationResponse,
  CredentialGetRequest,
  CredentialGetResponse,
  AbortRequest,
  DisconnectRequest,
  ReconnectRequest,
  AbortResponse,
  ErrorResponse,
}

/**
 * The params provided by the page-script are created in an insecure environment and
 * should not be trusted. This type is used to ensure that the content-script does not
 * trust the `origin` or `sameOriginWithAncestors` params.
 */
export type InsecureCreateCredentialParams = Omit<
  CreateCredentialParams,
  "origin" | "sameOriginWithAncestors"
>;

export type CredentialCreationRequest = {
  type: MessageType.CredentialCreationRequest;
  data: InsecureCreateCredentialParams;
};

export type CredentialCreationResponse = {
  type: MessageType.CredentialCreationResponse;
  result?: CreateCredentialResult;
};

/**
 * The params provided by the page-script are created in an insecure environment and
 * should not be trusted. This type is used to ensure that the content-script does not
 * trust the `origin` or `sameOriginWithAncestors` params.
 */
export type InsecureAssertCredentialParams = Omit<
  AssertCredentialParams,
  "origin" | "sameOriginWithAncestors"
>;

export type CredentialGetRequest = {
  type: MessageType.CredentialGetRequest;
  data: InsecureAssertCredentialParams;
};

export type CredentialGetResponse = {
  type: MessageType.CredentialGetResponse;
  result?: AssertCredentialResult;
};

export type AbortRequest = {
  type: MessageType.AbortRequest;
  abortedRequestId: string;
};

export type DisconnectRequest = {
  type: MessageType.DisconnectRequest;
};

export type ReconnectRequest = {
  type: MessageType.ReconnectRequest;
};

export type ErrorResponse = {
  type: MessageType.ErrorResponse;
  error: string;
};

export type AbortResponse = {
  type: MessageType.AbortResponse;
  abortedRequestId: string;
};

export type Message =
  | CredentialCreationRequest
  | CredentialCreationResponse
  | CredentialGetRequest
  | CredentialGetResponse
  | AbortRequest
  | DisconnectRequest
  | ReconnectRequest
  | AbortResponse
  | ErrorResponse;
