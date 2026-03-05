import { GetSendAccessTokenError } from "./get-send-access-token-error.type";

/**
 * Represents the possible errors that can occur when trying to retrieve a SendAccessToken by
 * just a sendId. Extends {@link GetSendAccessTokenError}.
 */
export type TryGetSendAccessTokenError = { kind: "expired" } | GetSendAccessTokenError;
