import { Opaque } from "type-fest";

// Keeper's auth/sync protocol passes several distinct opaque byte blobs around — tokens and
// identifiers that are all Uint8Arrays and frequently sit next to each other in the same call
// (e.g. `validate2FA(loginToken, code, channelUid, ...)` or `syncDownRequest(sessionToken,
// continuationToken)`). These opaque types make swapping one for another a compile error.
// They carry no runtime cost — they are still plain Uint8Arrays at runtime.

/** Encrypted device token identifying this registered device to the server. */
export type DeviceToken = Opaque<Uint8Array, "DeviceToken">;

/** Encrypted session token authenticating vault/sync requests after login. */
export type SessionToken = Opaque<Uint8Array, "SessionToken">;

/** Encrypted login token threaded through the login / 2FA / device-approval flow. */
export type LoginToken = Opaque<Uint8Array, "LoginToken">;

/** Per-login message session identifier, tied to the push websocket. */
export type MessageSessionUid = Opaque<Uint8Array, "MessageSessionUid">;

/** Identifier of a specific two-factor channel. */
export type ChannelUid = Opaque<Uint8Array, "ChannelUid">;

/** Pagination cursor returned by sync-down to fetch the next page. */
export type ContinuationToken = Opaque<Uint8Array, "ContinuationToken">;
