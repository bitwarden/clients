// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export class AccessTokenRequest {
  name: EncString;
  encryptedPayload: EncString;
  key: EncString;
  expireAt: Date;
}
