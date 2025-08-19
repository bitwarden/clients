import {
  CreateCredentialParams,
  CreateCredentialResult,
  AssertCredentialParams,
  AssertCredentialResult,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";

export const MessageTypes = {
  CredentialCreationRequest: 0,
  CredentialCreationResponse: 1,
  CredentialGetRequest: 2,
  CredentialGetResponse: 3,
  AbortRequest: 4,
  DisconnectRequest: 5,
  ReconnectRequest: 6,
  AbortResponse: 7,
  ErrorResponse: 8,
} as const;

export type MessageType = (typeof MessageTypes)[keyof typeof MessageTypes];

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
  type: typeof MessageTypes.CredentialCreationRequest;
  data: InsecureCreateCredentialParams;
};

export type CredentialCreationResponse = {
  type: typeof MessageTypes.CredentialCreationResponse;
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
  type: typeof MessageTypes.CredentialGetRequest;
  data: InsecureAssertCredentialParams;
};

export type CredentialGetResponse = {
  type: typeof MessageTypes.CredentialGetResponse;
  result?: AssertCredentialResult;
};

export type AbortRequest = {
  type: typeof MessageTypes.AbortRequest;
  abortedRequestId: string;
};

export type DisconnectRequest = {
  type: typeof MessageTypes.DisconnectRequest;
};

export type ReconnectRequest = {
  type: typeof MessageTypes.ReconnectRequest;
};

export type ErrorResponse = {
  type: typeof MessageTypes.ErrorResponse;
  error: string;
};

export type AbortResponse = {
  type: typeof MessageTypes.AbortResponse;
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
