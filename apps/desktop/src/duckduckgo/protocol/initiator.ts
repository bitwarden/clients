import {
  DDGEphemeralPrivateKey,
  DDGEphemeralPublicKey,
  DDGSessionKey,
  decrypt,
  encrypt,
  Padding,
} from "./crypto";
import {
  DDG_HANDSHAKE,
  DDG_PROTOCOL_VERSION,
  DDGCommandBody,
  DDGEncryptedMessage,
  DDGEncryptedResponse,
  DDGError,
  DDGHandshake,
  DDGHandshakeResponse,
  DDGOutbound,
  InitiatorState,
} from "./messages";

/** Raised when the responder answers a handshake with an error rather than a session key. */
export class DDGHandshakeRefused extends Error {
  constructor(readonly reason: DDGError) {
    super(`The responder refused the handshake: ${reason}`);
  }
}

/**
 * DuckDuckGo's side of the protocol.
 * https://github.com/duckduckgo/apple-browsers/tree/04d678b447869c3a640714718a466b36407db8b6/macOS/DuckDuckGo/PasswordManager/Bitwarden
 *
 * Written to be close to DuckDuckGo's implementation for testing. We want to ensure permanent
 * compatibility with DuckDuckGo's implementation, so it must be byte-for-byte the same. It
 * performs no I/O: it produces messages and consumes replies.
 */
export class DuckDuckGoInitiator {
  private state: InitiatorState = InitiatorState.Disconnected;
  private sessionKey?: DDGSessionKey;
  private ephemeralPublicKey?: DDGEphemeralPublicKey;
  private ephemeralPrivateKey?: DDGEphemeralPrivateKey;
  private nextMessageId = 1;

  constructor(private readonly applicationName: string) {}

  get currentState(): InitiatorState {
    return this.state;
  }

  /**
   * Starts a session: generates a fresh ephemeral RSA pair and returns the handshake to send.
   *
   * A new pair every time. The keys carry the session key; they are not an identity, so the
   * responder has nothing to pin a pairing to.
   */
  startHandshake(): DDGHandshake {
    if (this.state === InitiatorState.AwaitingHandshakeResponse) {
      throw new Error("A handshake is already outstanding.");
    }

    const { publicKey, privateKey } = DDGEphemeralPrivateKey.generatePair();
    this.ephemeralPublicKey = publicKey;
    this.ephemeralPrivateKey = privateKey;
    this.sessionKey = undefined;
    this.state = InitiatorState.AwaitingHandshakeResponse;

    return {
      version: DDG_PROTOCOL_VERSION,
      messageId: this.takeMessageId(),
      command: DDG_HANDSHAKE,
      payload: {
        publicKey: publicKey.toBase64Spki(),
        applicationName: this.applicationName,
      },
    };
  }

  /**
   * Encrypts a command for the responder, zero-padded as DuckDuckGo does.
   *
   * @throws Error unless a session is paired.
   */
  sendCommand(command: string, payload?: unknown): DDGEncryptedMessage {
    if (this.state !== InitiatorState.Paired || this.sessionKey == null) {
      throw new Error(`Cannot send a command while ${this.state}.`);
    }

    const body: DDGCommandBody = { command, payload };

    return {
      version: DDG_PROTOCOL_VERSION,
      messageId: this.takeMessageId(),
      encryptedCommand: encrypt(JSON.stringify(body), this.sessionKey, Padding.Zero),
    };
  }

  /**
   * Consumes one message from the responder, dispatched on what this side is waiting for.
   *
   * @returns the command body of an encrypted response, or `undefined` for a handshake answer,
   * which carries the session key rather than a payload.
   * @throws DDGHandshakeRefused when the responder refused the handshake.
   * @throws Error when nothing was outstanding to answer.
   */
  receive(message: DDGOutbound): DDGCommandBody | undefined {
    switch (this.state) {
      case InitiatorState.AwaitingHandshakeResponse:
        this.completeHandshake(message as DDGHandshakeResponse);
        return undefined;

      case InitiatorState.Paired:
        return this.readResponse(message as DDGEncryptedResponse);

      // Nothing was sent, or the session is over; there is no key to read a reply with.
      case InitiatorState.Disconnected:
      case InitiatorState.Refused:
        throw new Error(`Received a message while ${this.state}.`);
    }
  }

  /** Unwraps the session key the responder generated, or records its refusal. */
  private completeHandshake(response: DDGHandshakeResponse): void {
    if ("error" in response.payload) {
      this.state = InitiatorState.Refused;
      throw new DDGHandshakeRefused(response.payload.error);
    }

    this.sessionKey = this.privateKey().unwrapSessionKey(response.payload.sharedKey);
    this.state = InitiatorState.Paired;
  }

  /** Bitwarden answers with PKCS#7, not the padding the command used. */
  private readResponse(response: DDGEncryptedResponse): DDGCommandBody {
    return JSON.parse(
      decrypt(response.encryptedPayload.encryptedString, this.sessionKey!, Padding.Pkcs7),
    ) as DDGCommandBody;
  }

  /** Whether a reply is an error rather than the encrypted response it was asked for. */
  static isError(response: DDGOutbound): response is DDGHandshakeResponse {
    return "payload" in response && "error" in (response.payload as object);
  }

  private privateKey(): DDGEphemeralPrivateKey {
    if (this.ephemeralPrivateKey == null) {
      throw new Error("No ephemeral key; start a handshake first.");
    }
    return this.ephemeralPrivateKey;
  }

  private takeMessageId(): string {
    return `${this.nextMessageId++}`;
  }
}
