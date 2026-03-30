import { ReceiveUrlData } from "./receive-url-data";

export interface ReceiveFileUploadInput {
  unencryptedFileBuffer: ArrayBuffer;
  fileName: string;
  urlData: ReceiveUrlData;
  publicKey: Uint8Array;
}
