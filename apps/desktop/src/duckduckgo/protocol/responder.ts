import { DDGEphemeralPublicKey, DDGSessionKey, decrypt, encrypt, Padding, toWire } from "./crypto";
import {
  DDG_PROTOCOL_VERSION,
  DDGCommandBody,
  DDGEncryptedMessage,
  DDGError,
  DDGHandshake,
  DDGInbound,
  DDGOutbound,
  isHandshake,
  ResponderState,
} from "./messages";

/**
 * Driver that implements the host UI layer. This needs to be able to show a UI prompt to ask for
 * consent.
 */
export interface DDGResponderHost {
  /** Asks the user whether to pair with `applicationName`. Returning false refuses the session. */
  confirmPairing(applicationName: string): Promise<boolean>;
  /** Runs a decrypted command and returns the payload to send back. */
  runCommand(body: DDGCommandBody): Promise<unknown>;
}

/**
 * Bitwarden's side of the DuckDuckGo protocol: what may be said next, and what the reply is.
 *
 * Performs no I/O. It is handed a message and returns the message to send. See
 * {@link ResponderState} for the states and {@link DDGError} for the failures.
 */
export class DuckDuckGoResponder {
  private state: ResponderState = ResponderState.Unpaired;
  private sessionKey?: DDGSessionKey;

  constructor(private readonly host: DDGResponderHost) {}

  /**
   * Restores a session from a key the caller kept, e.g. across a restart, so the user is not
   * asked to pair again.
   */
  resume(sessionKey: DDGSessionKey): void {
    this.sessionKey = sessionKey;
    this.state = ResponderState.Paired;
  }

  get currentState(): ResponderState {
    return this.state;
  }

  /**
   * Handles one inbound message.
   *
   * @returns the reply to send.
   */
  async handle(message: DDGInbound): Promise<DDGOutbound | undefined> {
    if (message.version !== DDG_PROTOCOL_VERSION) {
      return this.error(message.messageId, DDGError.VersionDiscrepancy);
    }

    switch (this.state) {
      // No session key, so only a handshake can be served. Refused answers as Unpaired does; a
      // peer learns nothing from being told the two apart.
      case ResponderState.Unpaired:
      case ResponderState.Refused:
        return isHandshake(message)
          ? await this.handleHandshake(message)
          : this.error(message.messageId, DDGError.CannotDecrypt);

      // The user is still deciding. Answering now would act on a pairing they have not granted,
      // or stack a second dialog on the one in front of them.
      case ResponderState.AwaitingVerification:
        return this.error(message.messageId, DDGError.CannotDecrypt);

      // A handshake while paired is accepted and replaces the session; see handleHandshake.
      case ResponderState.Paired:
        return isHandshake(message)
          ? await this.handleHandshake(message)
          : await this.handleEncrypted(message);
    }
  }

  private async handleHandshake(message: DDGHandshake): Promise<DDGOutbound> {
    const { publicKey, applicationName } = message.payload ?? {};
    if (!publicKey) {
      return this.error(message.messageId, DDGError.CannotDecrypt);
    }

    // A handshake while already paired replaces the session: nothing identifies a peer, so there
    // is no basis for preferring the existing one. Refusing it also drops the existing session,
    // so a declined prompt ends a pairing the user already had.
    this.state = ResponderState.AwaitingVerification;

    if (!(await this.host.confirmPairing(applicationName))) {
      this.state = ResponderState.Refused;
      this.sessionKey = undefined;
      return this.error(message.messageId, DDGError.Canceled);
    }

    let wrapped: string;
    let sessionKey: DDGSessionKey;
    try {
      sessionKey = DDGSessionKey.generate();
      wrapped = DDGEphemeralPublicKey.fromBase64Spki(publicKey).wrapSessionKey(sessionKey);
    } catch {
      // The peer cannot tell a malformed public key from any other failure here.
      this.state = ResponderState.Unpaired;
      return this.error(message.messageId, DDGError.CannotDecrypt);
    }

    this.sessionKey = sessionKey;
    this.state = ResponderState.Paired;

    return {
      version: DDG_PROTOCOL_VERSION,
      messageId: message.messageId,
      payload: { status: "success", sharedKey: wrapped },
    };
  }

  private async handleEncrypted(message: DDGEncryptedMessage): Promise<DDGOutbound> {
    // Only reached while Paired, which is the only state that holds a key.
    const key = this.sessionKey;
    if (key == null) {
      return this.error(message.messageId, DDGError.CannotDecrypt);
    }

    let body: DDGCommandBody;
    try {
      // DuckDuckGo zero-pads what it sends, and so does the native messaging test runner.
      body = JSON.parse(decrypt(message.encryptedCommand, key, Padding.Zero)) as DDGCommandBody;
    } catch {
      return this.error(message.messageId, DDGError.CannotDecrypt);
    }

    const payload = await this.host.runCommand(body);

    return {
      version: DDG_PROTOCOL_VERSION,
      messageId: message.messageId,
      // Outbound is PKCS#7: the reply is an ordinary Bitwarden encstring.
      encryptedPayload: toWire(
        encrypt(JSON.stringify({ command: body.command, payload }), key, Padding.Pkcs7),
      ),
    };
  }

  /** The key to persist after a successful pairing, if the caller keeps one. */
  get pairedKey(): DDGSessionKey | undefined {
    return this.sessionKey;
  }

  private error(messageId: string, error: DDGError): DDGOutbound {
    return { version: DDG_PROTOCOL_VERSION, messageId, payload: { error } };
  }
}
