import { EncString } from "@bitwarden/sdk-internal";

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

export class AccessTokenRequest {
  name: EncString;
  encryptedPayload: EncString;
  key: EncString;
  expireAt: Date;
}
