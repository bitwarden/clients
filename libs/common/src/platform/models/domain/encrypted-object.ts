// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

export class EncryptedObject {
  iv: Uint8Array;
  data: Uint8Array;
  mac: Uint8Array;
}
