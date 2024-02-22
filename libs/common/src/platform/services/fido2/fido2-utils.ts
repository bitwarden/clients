import { Utils } from "../../misc/utils";

export class Fido2Utils {
  static bufferToString(bufferSource: BufferSource): string {
    const buffer = Fido2Utils.bufferSourceToUint8Array(bufferSource);

    return Utils.fromBufferToUrlB64(buffer);
  }

  static stringToBuffer(str: string): Uint8Array {
    return Utils.fromUrlB64ToArray(str);
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
}
