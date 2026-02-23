import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import type {
  AssertCredentialResult,
  CreateCredentialResult,
} from "../../abstractions/fido2/fido2-client.service.abstraction";
import { Utils } from "../../misc/utils";

// @ts-strict-ignore
export class Fido2Utils {
  static createResultToJson(result: CreateCredentialResult): any {
    return {
      id: result.credentialId,
      rawId: result.credentialId,
      response: {
        clientDataJSON: result.clientDataJSON,
        authenticatorData: result.authData,
        transports: result.transports,
        publicKey: result.publicKey,
        publicKeyAlgorithm: result.publicKeyAlgorithm,
        attestationObject: result.attestationObject,
      },
      authenticatorAttachment: "platform",
      clientExtensionResults: result.extensions,
      type: "public-key",
    };
  }

  static getResultToJson(result: AssertCredentialResult): any {
    return {
      id: result.credentialId,
      rawId: result.credentialId,
      response: {
        clientDataJSON: result.clientDataJSON,
        authenticatorData: result.authenticatorData,
        signature: result.signature,
        userHandle: result.userHandle,
      },
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      type: "public-key",
    };
  }

  static bufferToString(bufferSource: BufferSource): string {
    return Utils.fromArrayToUrlB64(Fido2Utils.bufferSourceToUint8Array(bufferSource));
  }

  static stringToBuffer(str: string): ArrayBuffer {
    return Utils.fromUrlB64ToArray(str).buffer as ArrayBuffer;
  }

  static bufferSourceToUint8Array(bufferSource: BufferSource): Uint8Array {
    if (Fido2Utils.isArrayBuffer(bufferSource)) {
      return new Uint8Array(bufferSource);
    } else {
      return new Uint8Array(bufferSource.buffer, bufferSource.byteOffset, bufferSource.byteLength);
    }
  }

  /** Utility function to identify type of bufferSource. Necessary because of differences between runtimes */
  private static isArrayBuffer(bufferSource: BufferSource): bufferSource is ArrayBuffer {
    return bufferSource instanceof ArrayBuffer || bufferSource.buffer === undefined;
  }

  static fromB64toUrlB64(b64Str: string) {
    return Utils.fromB64toUrlB64(b64Str);
  }

  static fromBufferToB64(buffer: ArrayBuffer): string {
    return Utils.fromBufferToB64(buffer);
  }

  static fromB64ToArray(str: string): Uint8Array {
    return Utils.fromB64ToArray(str);
  }

  static fromUrlB64ToB64(urlB64Str: string): string {
    return Utils.fromUrlB64ToB64(urlB64Str);
  }

  /**
   * This methods returns true if a cipher either has no passkeys, or has a passkey matching with userHandle
   * @param userHandle
   */
  static cipherHasNoOtherPasskeys(cipher: CipherView, userHandle: string): boolean {
    if (cipher.login.fido2Credentials == null || cipher.login.fido2Credentials.length === 0) {
      return true;
    }

    return cipher.login.fido2Credentials.some((passkey) => passkey.userHandle === userHandle);
  }
}
