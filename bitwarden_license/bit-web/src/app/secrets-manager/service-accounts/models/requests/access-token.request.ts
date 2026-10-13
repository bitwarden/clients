// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";

export class AccessTokenRequest {
  name: EncString;
  encryptedPayload: EncString;
  key: EncString;
  expireAt: Date;
}
