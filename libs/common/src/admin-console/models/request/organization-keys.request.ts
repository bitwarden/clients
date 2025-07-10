import { KeysRequest } from "../../../models/request/keys.request";

export class OrganizationKeysRequest extends KeysRequest {
  constructor(publicKey: string, encryptedPrivateKey: string) {
    super(publicKey, encryptedPrivateKey);
  }
}
