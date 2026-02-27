// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Platform } from "../enums";

export class Session {
  id: string;
  keyIterationCount: number;
  token: string;
  platform: Platform;
  encryptedPrivateKey: string;
}
