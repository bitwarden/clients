/**
 * The DuckDuckGo native messaging wire format.
 *
 * DuckDuckGo is always the initiator: it opens with a handshake, then sends encrypted commands
 * that Bitwarden, the responder, answers. The socket also carries the general browser
 * integration's traffic, which has no `version` field; that is how the two are told apart.
 */

import { DDGEncstringPayload } from "./crypto";

/** The only protocol version in existence. */
export const DDG_PROTOCOL_VERSION = 1;

/** Present on every message in both directions. */
export type DDGEnvelope = {
  version: number;
  messageId: string;
};

/** The one unencrypted command: the opening of a session. */
export const DDG_HANDSHAKE = "bw-handshake";

/** Initiator → responder, opening a session. */
export type DDGHandshake = DDGEnvelope & {
  command: typeof DDG_HANDSHAKE;
  payload: {
    /** The initiator's ephemeral RSA public key, base64 SPKI. */
    publicKey: string;
    /** Shown to the user in the pairing prompt. Not authenticated. */
    applicationName: string;
  };
};

/** Responder → initiator, answering a handshake. */
export type DDGHandshakeResponse = DDGEnvelope & {
  payload: { status: "success"; sharedKey: string } | { error: DDGError };
};

/** Initiator → responder, once paired. The encstring holds `{ command, payload }`. */
export type DDGEncryptedMessage = DDGEnvelope & {
  encryptedCommand: string;
};

/** Responder → initiator. The encstring holds `{ command, payload }`. */
export type DDGEncryptedResponse = DDGEnvelope & {
  encryptedPayload: DDGEncstringPayload;
};

export type DDGInbound = DDGHandshake | DDGEncryptedMessage;
export type DDGOutbound = DDGHandshakeResponse | DDGEncryptedResponse;

/**
 * Errors the responder returns unencrypted. An unpaired peer is told only that something could
 * not be decrypted, never why.
 */
export const DDGError = Object.freeze({
  /** The message is some version this build does not speak. */
  VersionDiscrepancy: "version-discrepancy",
  /** The user declined the pairing, or the integration is switched off. */
  Canceled: "canceled",
  /** No session key, a failed MAC, an unparseable envelope, or plaintext that is not JSON. */
  CannotDecrypt: "cannot-decrypt",
} as const);
export type DDGError = (typeof DDGError)[keyof typeof DDGError];

/** What the responder is doing about a peer. */
export const ResponderState = Object.freeze({
  /** No session key. Only a handshake is accepted. */
  Unpaired: "unpaired",
  /** A handshake is with the user. Further messages are refused until they answer. */
  AwaitingVerification: "awaiting-verification",
  /** A session key is held; encrypted commands are served. */
  Paired: "paired",
  /** The user declined. Answers the same as Unpaired; kept apart to record that they were asked. */
  Refused: "refused",
} as const);
export type ResponderState = (typeof ResponderState)[keyof typeof ResponderState];

/** What the initiator is doing about a session. */
export const InitiatorState = Object.freeze({
  /** Nothing sent yet. */
  Disconnected: "disconnected",
  /** A handshake is out; waiting for the user at the other end to accept it. */
  AwaitingHandshakeResponse: "awaiting-handshake-response",
  /** A session key is held; commands can be sent. */
  Paired: "paired",
  /** The responder returned an error to the handshake. */
  Refused: "refused",
} as const);
export type InitiatorState = (typeof InitiatorState)[keyof typeof InitiatorState];

/** The decrypted body of an encrypted message, in both directions. */
export type DDGCommandBody = {
  command: string;
  payload?: unknown;
};

export function isHandshake(message: DDGInbound): message is DDGHandshake {
  return (message as DDGHandshake).command === DDG_HANDSHAKE;
}
