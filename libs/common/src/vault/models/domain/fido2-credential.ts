import { Jsonify } from "type-fest";

import { Fido2Credential as SdkFido2Credential } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
import { Fido2CredentialData } from "../data/fido2-credential.data";
import { Fido2CredentialView } from "../view/fido2-credential.view";

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

    this.credentialId = new EncString(obj.credentialId);
    this.keyType = new EncString(obj.keyType);
    this.keyAlgorithm = new EncString(obj.keyAlgorithm);
    this.keyCurve = new EncString(obj.keyCurve);
    this.keyValue = new EncString(obj.keyValue);
    this.rpId = new EncString(obj.rpId);
    this.counter = new EncString(obj.counter);
    this.discoverable = new EncString(obj.discoverable);
    this.userHandle = conditionalEncString(obj.userHandle);
    this.userName = conditionalEncString(obj.userName);
    this.rpName = conditionalEncString(obj.rpName);
    this.userDisplayName = conditionalEncString(obj.userDisplayName);
    this.creationDate = new Date(obj.creationDate);
  }

  async decrypt(
    orgId: string | undefined,
    encKey?: SymmetricCryptoKey,
  ): Promise<Fido2CredentialView> {
    const view = await this.decryptObj<Fido2Credential, Fido2CredentialView>(
      this,
      new Fido2CredentialView(),
      [
        "credentialId",
        "keyType",
        "keyAlgorithm",
        "keyCurve",
        "keyValue",
        "rpId",
        "userHandle",
        "userName",
        "rpName",
        "userDisplayName",
      ],
      orgId ?? null,
      encKey,
    );

    const { counter } = await this.decryptObj<
      Fido2Credential,
      {
        counter: string;
      }
    >(this, { counter: "" }, ["counter"], orgId ?? null, encKey);
    // Counter will end up as NaN if this fails
    view.counter = parseInt(counter);

    const { discoverable } = await this.decryptObj<Fido2Credential, { discoverable: string }>(
      this,
      { discoverable: "" },
      ["discoverable"],
      orgId ?? null,
      encKey,
    );
    view.discoverable = discoverable === "true";
    view.creationDate = this.creationDate;

    return view;
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

    credential.credentialId = EncString.fromJSON(obj.credentialId);
    credential.keyType = EncString.fromJSON(obj.keyType);
    credential.keyAlgorithm = EncString.fromJSON(obj.keyAlgorithm);
    credential.keyCurve = EncString.fromJSON(obj.keyCurve);
    credential.keyValue = EncString.fromJSON(obj.keyValue);
    credential.rpId = EncString.fromJSON(obj.rpId);
    credential.userHandle = encStringFrom(obj.userHandle);
    credential.userName = encStringFrom(obj.userName);
    credential.counter = EncString.fromJSON(obj.counter);
    credential.rpName = encStringFrom(obj.rpName);
    credential.userDisplayName = encStringFrom(obj.userDisplayName);
    credential.discoverable = EncString.fromJSON(obj.discoverable);
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
      credentialId: this.credentialId?.toSdk(),
      keyType: this.keyType.toSdk(),
      keyAlgorithm: this.keyAlgorithm.toSdk(),
      keyCurve: this.keyCurve.toSdk(),
      keyValue: this.keyValue.toSdk(),
      rpId: this.rpId.toSdk(),
      userHandle: this.userHandle?.toSdk(),
      userName: this.userName?.toSdk(),
      counter: this.counter.toSdk(),
      rpName: this.rpName?.toSdk(),
      userDisplayName: this.userDisplayName?.toSdk(),
      discoverable: this.discoverable?.toSdk(),
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

    credential.credentialId = EncString.fromJSON(obj.credentialId);
    credential.keyType = EncString.fromJSON(obj.keyType);
    credential.keyAlgorithm = EncString.fromJSON(obj.keyAlgorithm);
    credential.keyCurve = EncString.fromJSON(obj.keyCurve);
    credential.keyValue = EncString.fromJSON(obj.keyValue);
    credential.rpId = EncString.fromJSON(obj.rpId);
    credential.counter = EncString.fromJSON(obj.counter);
    credential.userHandle = encStringFrom(obj.userHandle);
    credential.userName = encStringFrom(obj.userName);
    credential.rpName = encStringFrom(obj.rpName);
    credential.userDisplayName = encStringFrom(obj.userDisplayName);
    credential.discoverable = EncString.fromJSON(obj.discoverable);
    credential.creationDate = new Date(obj.creationDate);

    return credential;
  }
}
