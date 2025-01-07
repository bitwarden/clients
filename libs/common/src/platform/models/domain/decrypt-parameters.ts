// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class DecryptParameters<T> {
  encKey: T;
  data: T;
  iv: T;
  macKey: T | null;
  mac: T | null;
  macData: T | null;
}
