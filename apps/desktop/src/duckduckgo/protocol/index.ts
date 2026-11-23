/**
 * The DuckDuckGo native messaging protocol, both sides of it.
 *
 * What this exports is the protocol's surface; the rest of the folder is internal. See
 * {@link DuckDuckGoResponder} for Bitwarden's side and {@link DuckDuckGoInitiator} for
 * DuckDuckGo's.
 *
 * DuckDuckGo always opens the session. It sends an ephemeral RSA public key; Bitwarden asks the
 * user, generates the session key, and sends it back wrapped to that key. Every later message is
 * encrypted under the session key.
 *
 *   DuckDuckGo (initiator)                                   Bitwarden (responder)
 *   InitiatorState                                           ResponderState
 *
 *   Disconnected
 *        │  bw-handshake { publicKey (b64 SPKI), applicationName }
 *        ├────────────────────────────────────────────────────────▶ Unpaired
 *   AwaitingHandshakeResponse                                           │
 *        │                                                     AwaitingVerification
 *        │                                                      (asks the user)
 *        │  { status: "success", sharedKey }   ◀── accepted ────────────┤
 *        │  { error: "canceled" }              ◀── declined ────────────┤
 *        ◀────────────────────────────────────────────────────────┬─────┘
 *   Paired / Refused                                          Paired / Refused
 *        │                                                         │
 *        │  { encryptedCommand }   zero-padded, a plain encstring   │
 *        ├────────────────────────────────────────────────────────▶│ runs it against the vault
 *        │  { encryptedPayload }   PKCS#7, an EncString object      │
 *        ◀─────────────────────────────────────────────────────────┤
 *
 * Both encstrings are `2.<iv>|<data>|<mac>`: AES-256-CBC, then HMAC-SHA256 over `iv ‖ ciphertext`.
 * The two directions pad differently, and the reply is an object while the command is a string —
 * see {@link Padding} and {@link DDGEncstringPayload}, which document what DuckDuckGo does.
 *
 * ref: https://github.com/duckduckgo/apple-browsers/tree/04d678b447869c3a640714718a466b36407db8b6/macOS/DuckDuckGo/PasswordManager/Bitwarden
 */
export {
  DDGDecryptError,
  DDGEncstringPayload,
  DDGEphemeralPrivateKey,
  DDGEphemeralPublicKey,
  DDGSessionKey,
  decrypt,
  encrypt,
  Padding,
  toWire,
} from "./crypto";
export { DDGHandshakeRefused, DuckDuckGoInitiator } from "./initiator";
export {
  DDG_HANDSHAKE,
  DDG_PROTOCOL_VERSION,
  DDGCommandBody,
  DDGEncryptedMessage,
  DDGEncryptedResponse,
  DDGEnvelope,
  DDGError,
  DDGHandshake,
  DDGHandshakeResponse,
  DDGInbound,
  DDGOutbound,
  InitiatorState,
  isHandshake,
  ResponderState,
} from "./messages";
export { DDGResponderHost, DuckDuckGoResponder } from "./responder";
