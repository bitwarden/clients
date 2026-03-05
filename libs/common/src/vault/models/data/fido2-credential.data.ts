import { Fido2CredentialApi } from "../api/fido2-credential.api";

export class Fido2CredentialData {
  credentialId!: string;
  keyType!: string;
  keyAlgorithm!: string;
  keyCurve!: string;
  keyValue!: string;
  rpId!: string;
  userHandle?: string;
  userName?: string;
  counter!: string;
  rpName?: string;
  userDisplayName?: string;
  discoverable!: string;
  creationDate!: string;

  constructor(data?: Fido2CredentialApi) {
    if (data == null) {
      return;
    }

    this.credentialId = data.credentialId;
    this.keyType = data.keyType;
    this.keyAlgorithm = data.keyAlgorithm;
    this.keyCurve = data.keyCurve;
    this.keyValue = data.keyValue;
    this.rpId = data.rpId;
    this.userHandle = data.userHandle;
    this.userName = data.userName;
    this.counter = data.counter;
    this.rpName = data.rpName;
    this.userDisplayName = data.userDisplayName;
    this.discoverable = data.discoverable;
    this.creationDate = data.creationDate;
  }
}
