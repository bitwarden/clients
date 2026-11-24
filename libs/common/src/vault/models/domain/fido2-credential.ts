import { Jsonify } from "type-fest";

import { Fido2Credential as SdkFido2Credential, EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { Fido2CredentialData } from "../data/fido2-credential.data";

export class Fido2Credential extends Domain {
  credentialId!: EncString;
  keyType!: EncString;
  keyAlgorithm!: EncString;
  keyCurve!: EncString;
  keyValue!: EncString;
  rpId!: EncString;
  userHandle?: EncString;
  userName?: EncString;
  counter!: EncString;
  rpName?: EncString;
  userDisplayName?: EncString;
  discoverable!: EncString;
  creationDate!: Date;

  constructor(obj?: Fido2CredentialData) {
    super();
    if (obj == null) {
      this.creationDate = new Date();
      return;
    }

    this.credentialId = obj.credentialId as EncString;
    this.keyType = obj.keyType as EncString;
    this.keyAlgorithm = obj.keyAlgorithm as EncString;
    this.keyCurve = obj.keyCurve as EncString;
    this.keyValue = obj.keyValue as EncString;
    this.rpId = obj.rpId as EncString;
    this.counter = obj.counter as EncString;
    this.discoverable = obj.discoverable as EncString;
    this.userHandle = (obj.userHandle ?? undefined) as EncString;
    this.userName = (obj.userName ?? undefined) as EncString;
    this.rpName = (obj.rpName ?? undefined) as EncString;
    this.userDisplayName = (obj.userDisplayName ?? undefined) as EncString;
    this.creationDate = new Date(obj.creationDate);
  }

  toFido2CredentialData(): Fido2CredentialData {
    const i = new Fido2CredentialData();
    i.creationDate = this.creationDate.toISOString();
    this.buildDataModel(this, i, {
      credentialId: null,
      keyType: null,
      keyAlgorithm: null,
      keyCurve: null,
      keyValue: null,
      rpId: null,
      userHandle: null,
      userName: null,
      counter: null,
      rpName: null,
      userDisplayName: null,
      discoverable: null,
    });
    return i;
  }

  static fromJSON(obj: Jsonify<Fido2Credential> | undefined): Fido2Credential | undefined {
    if (obj == null) {
      return undefined;
    }

    const credential = new Fido2Credential();

    credential.credentialId = obj.credentialId ?? null;
    credential.keyType = obj.keyType ?? null;
    credential.keyAlgorithm = obj.keyAlgorithm ?? null;
    credential.keyCurve = obj.keyCurve ?? null;
    credential.keyValue = obj.keyValue ?? null;
    credential.rpId = obj.rpId ?? null;
    credential.userHandle = obj.userHandle ?? undefined;
    credential.userName = obj.userName ?? undefined;
    credential.counter = obj.counter ?? null;
    credential.rpName = obj.rpName ?? undefined;
    credential.userDisplayName = obj.userDisplayName ?? undefined;
    credential.discoverable = obj.discoverable ?? null;
    credential.creationDate = new Date(obj.creationDate);

    return credential;
  }

  /**
   *  Maps Fido2Credential to SDK format.
   *
   * @returns {SdkFido2Credential} The SDK Fido2Credential object.
   */
  toSdkFido2Credential(): SdkFido2Credential {
    return {
      credentialId: this.credentialId ?? undefined,
      keyType: this.keyType,
      keyAlgorithm: this.keyAlgorithm,
      keyCurve: this.keyCurve,
      keyValue: this.keyValue,
      rpId: this.rpId,
      userHandle: this.userHandle ?? undefined,
      userName: this.userName ?? undefined,
      counter: this.counter,
      rpName: this.rpName ?? undefined,
      userDisplayName: this.userDisplayName ?? undefined,
      discoverable: this.discoverable ?? undefined,
      creationDate: this.creationDate.toISOString(),
    };
  }

  /**
   * Maps an SDK Fido2Credential object to a Fido2Credential
   * @param obj - The SDK Fido2Credential object
   */
  static fromSdkFido2Credential(obj?: SdkFido2Credential): Fido2Credential | undefined {
    if (obj == null) {
      return undefined;
    }

    const credential = new Fido2Credential();

    credential.credentialId = obj.credentialId ?? null;
    credential.keyType = obj.keyType ?? null;
    credential.keyAlgorithm = obj.keyAlgorithm ?? null;
    credential.keyCurve = obj.keyCurve ?? null;
    credential.keyValue = obj.keyValue ?? null;
    credential.rpId = obj.rpId ?? null;
    credential.counter = obj.counter ?? null;
    credential.userHandle = obj.userHandle ?? undefined;
    credential.userName = obj.userName ?? undefined;
    credential.rpName = obj.rpName ?? undefined;
    credential.userDisplayName = obj.userDisplayName ?? undefined;
    credential.discoverable = obj.discoverable ?? null;
    credential.creationDate = new Date(obj.creationDate);

    return credential;
  }
}
