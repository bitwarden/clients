/* eslint-disable no-console */
import "module-alias/register";

import { randomUUID } from "crypto";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
// eslint-disable-next-line no-restricted-imports
import {
  EncryptServiceImplementation,
  EncString,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
// eslint-disable-next-line no-restricted-imports
import { NodeCryptoFunctionService } from "@bitwarden/legacy-crypto/node";

// eslint-disable-next-line no-restricted-imports
import { DDGSessionKey, encrypt, Padding } from "../../src/duckduckgo/protocol";
// eslint-disable-next-line no-restricted-imports
import { DecryptedCommandData } from "../../src/models/native-messaging/decrypted-command-data";
// eslint-disable-next-line no-restricted-imports
import { EncryptedMessage } from "../../src/models/native-messaging/encrypted-message";
// eslint-disable-next-line no-restricted-imports
import { CredentialCreatePayload } from "../../src/models/native-messaging/encrypted-message-payloads/credential-create-payload";
// eslint-disable-next-line no-restricted-imports
import { CredentialUpdatePayload } from "../../src/models/native-messaging/encrypted-message-payloads/credential-update-payload";
// eslint-disable-next-line no-restricted-imports
import { EncryptedMessageResponse } from "../../src/models/native-messaging/encrypted-message-response";
// eslint-disable-next-line no-restricted-imports
import { MessageCommon } from "../../src/models/native-messaging/message-common";
// eslint-disable-next-line no-restricted-imports
import { UnencryptedMessage } from "../../src/models/native-messaging/unencrypted-message";
// eslint-disable-next-line no-restricted-imports
import { UnencryptedMessageResponse } from "../../src/models/native-messaging/unencrypted-message-response";

import IPCService, { IPCOptions } from "./ipc.service";
import * as config from "./variables";

/**
 * An encrypted message as DuckDuckGo puts it on the wire: `encryptedCommand` is the plain
 * `2.<iv>|<data>|<mac>` string, not a serialized EncString.
 */
type EncryptedMessageOnWire = Omit<EncryptedMessage, keyof MessageCommon | "encryptedCommand"> & {
  encryptedCommand: string;
};

type HandshakeResponse = {
  status: boolean;
  sharedKey: string;
  error?: "canceled" | "cannot-decrypt";
};

const CONFIRMATION_MESSAGE_TIMEOUT = 100 * 1000; // 100 seconds

export default class NativeMessageService {
  private ipcService: IPCService;
  private nodeCryptoFunctionService: NodeCryptoFunctionService;
  private encryptService: EncryptServiceImplementation;

  constructor(private apiVersion: number) {
    console.log("Starting native messaging service");
    this.ipcService = new IPCService(`bitwarden`, (rawMessage) => {
      console.log(`Received unexpected: `, rawMessage);
    });

    this.nodeCryptoFunctionService = new NodeCryptoFunctionService();
    this.encryptService = new EncryptServiceImplementation(
      this.nodeCryptoFunctionService,
      new ConsoleLogService(false),
      false,
    );
  }

  // Commands

  async sendHandshake(publicKey: string, applicationName: string): Promise<HandshakeResponse> {
    const rawResponse = await this.sendUnencryptedMessage(
      {
        command: "bw-handshake",
        payload: {
          publicKey,
          applicationName: applicationName,
        },
      },
      {
        overrideTimeout: CONFIRMATION_MESSAGE_TIMEOUT,
      },
    );
    return rawResponse.payload as HandshakeResponse;
  }

  async checkStatus(key: string): Promise<DecryptedCommandData> {
    const encryptedCommand = await this.encryptCommandData(
      {
        command: "bw-status",
      },
      key,
    );

    const response = await this.sendEncryptedMessage({
      encryptedCommand,
    });

    return this.decryptResponsePayload(response.encryptedPayload, key);
  }

  async credentialRetrieval(key: string, uri: string): Promise<DecryptedCommandData> {
    const encryptedCommand = await this.encryptCommandData(
      {
        command: "bw-credential-retrieval",
        payload: {
          uri: uri,
        },
      },
      key,
    );
    const response = await this.sendEncryptedMessage({
      encryptedCommand,
    });

    return this.decryptResponsePayload(response.encryptedPayload, key);
  }

  async credentialCreation(
    key: string,
    credentialData: CredentialCreatePayload,
  ): Promise<DecryptedCommandData> {
    const encryptedCommand = await this.encryptCommandData(
      {
        command: "bw-credential-create",
        payload: credentialData,
      },
      key,
    );
    const response = await this.sendEncryptedMessage({
      encryptedCommand,
    });

    return this.decryptResponsePayload(response.encryptedPayload, key);
  }

  async credentialUpdate(
    key: string,
    credentialData: CredentialUpdatePayload,
  ): Promise<DecryptedCommandData> {
    const encryptedCommand = await this.encryptCommandData(
      {
        command: "bw-credential-update",
        payload: credentialData,
      },
      key,
    );
    const response = await this.sendEncryptedMessage({
      encryptedCommand,
    });

    return this.decryptResponsePayload(response.encryptedPayload, key);
  }

  async generatePassword(key: string, userId: string): Promise<DecryptedCommandData> {
    const encryptedCommand = await this.encryptCommandData(
      {
        command: "bw-generate-password",
        payload: {
          userId: userId,
        },
      },
      key,
    );
    const response = await this.sendEncryptedMessage({
      encryptedCommand,
    });

    return this.decryptResponsePayload(response.encryptedPayload, key);
  }

  // Private message sending

  private async sendEncryptedMessage(
    message: EncryptedMessageOnWire,
    options: IPCOptions = {},
  ): Promise<EncryptedMessageResponse> {
    const result = await this.sendMessage(message, options);
    return result as EncryptedMessageResponse;
  }

  private async sendUnencryptedMessage(
    message: Omit<UnencryptedMessage, keyof MessageCommon>,
    options: IPCOptions = {},
  ): Promise<UnencryptedMessageResponse> {
    const result = await this.sendMessage(message, options);
    return result as UnencryptedMessageResponse;
  }

  private async sendMessage(
    message: Omit<UnencryptedMessage, keyof MessageCommon> | EncryptedMessageOnWire,
    options: IPCOptions,
  ): Promise<EncryptedMessageResponse | UnencryptedMessageResponse> {
    // Attempt to connect before sending any messages. If the connection has already
    // been made, this is a NOOP within the IPCService.
    await this.ipcService.connect();

    const commonFields: MessageCommon = {
      // Create a messageId that can be used as a lookup when we get a response
      messageId: randomUUID(),
      version: this.apiVersion,
    };
    const fullMessage = {
      ...message,
      ...commonFields,
    };

    console.log(`[NativeMessageService] sendMessage with id: ${fullMessage.messageId}`);

    const response = await this.ipcService.sendMessage(fullMessage, options);

    console.log(`[NativeMessageService] received response for message: ${fullMessage.messageId}`);

    return response;
  }

  disconnect() {
    this.ipcService.disconnect();
  }

  // Data Encryption
  /**
   * Encrypts a command the way DuckDuckGo does: zero padding, and the encstring as a plain
   * `2.<iv>|<data>|<mac>` string rather than a serialized EncString.
   *
   * ref: https://github.com/duckduckgo/apple-browsers/blob/04d678b447869c3a640714718a466b36407db8b6/macOS/DuckDuckGo/PasswordManager/Bitwarden/Services/BWEncryption.m#L123
   */
  private async encryptCommandData(
    commandData: DecryptedCommandData,
    key: string,
  ): Promise<string> {
    const sharedKey = await this.getSharedKeyForKey(key);

    return encrypt(
      JSON.stringify(commandData),
      DDGSessionKey.fromBytes(sharedKey.toEncoded()),
      Padding.Zero,
    );
  }

  private async decryptResponsePayload(
    payload: EncString,
    key: string,
  ): Promise<DecryptedCommandData> {
    const sharedKey = await this.getSharedKeyForKey(key);
    const decrypted = await this.encryptService.decryptString(payload, sharedKey);

    return JSON.parse(decrypted);
  }

  private async getSharedKeyForKey(key: string): Promise<SymmetricCryptoKey> {
    const dataBuffer = Utils.fromB64ToArray(key);
    const privKey = Utils.fromB64ToArray(config.testRsaPrivateKey);

    return new SymmetricCryptoKey(
      await this.nodeCryptoFunctionService.rsaDecrypt(dataBuffer, privKey, "sha1"),
    );
  }
}
