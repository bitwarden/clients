import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

// FIXME: Update this file to be type safe and remove this and next line
import type {
  AssertCredentialResult,
  CreateCredentialResult,
} from "../../abstractions/fido2/fido2-client.service.abstraction";

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
    return Fido2Utils.fromBufferToB64(Fido2Utils.bufferSourceToUint8Array(bufferSource))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  static stringToBuffer(str: string): ArrayBuffer {
    return Fido2Utils.fromB64ToArray(Fido2Utils.fromUrlB64ToB64(str)).buffer;
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
    return b64Str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  static fromBufferToB64(buffer: ArrayBuffer): string {
    if (buffer == null) {
      return null;
    }

    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return globalThis.btoa(binary);
  }

  static fromB64ToArray(str: string): Uint8Array {
    if (str == null) {
      return null;
    }

    const binaryString = globalThis.atob(str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  static fromUrlB64ToB64(urlB64Str: string): string {
    let output = urlB64Str.replace(/-/g, "+").replace(/_/g, "/");
    switch (output.length % 4) {
      case 0:
        break;
      case 2:
        output += "==";
        break;
      case 3:
        output += "=";
        break;
      default:
        throw new Error("Illegal base64url string!");
    }

    return output;
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
