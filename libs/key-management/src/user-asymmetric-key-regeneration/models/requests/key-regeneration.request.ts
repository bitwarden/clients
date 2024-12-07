import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

export class KeyRegenerationRequest {
  userPublicKey: string;
  userKeyEncryptedUserPrivateKey: EncString;
}
