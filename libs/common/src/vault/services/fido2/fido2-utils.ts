export class Fido2Utils {
  static bufferToString(bufferSource: BufferSource): string {
    let buffer: Uint8Array;
    if (bufferSource instanceof ArrayBuffer || bufferSource.buffer === undefined) {
      buffer = new Uint8Array(bufferSource as ArrayBuffer);
    } else {
      buffer = new Uint8Array(bufferSource.buffer);
    }

    return Fido2Utils.fromBufferToB64(buffer)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  static stringToBuffer(str: string): Uint8Array {
    return Fido2Utils.fromB64ToArray(Fido2Utils.fromUrlB64ToB64(str));
  }

  static bufferSourceToUint8Array(bufferSource: BufferSource) {
    if (Fido2Utils.isArrayBuffer(bufferSource)) {
      return new Uint8Array(bufferSource);
    } else {
      return new Uint8Array(bufferSource.buffer);
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
}
