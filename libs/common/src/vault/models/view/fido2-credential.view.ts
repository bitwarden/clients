import { Jsonify } from "type-fest";

import {
  Fido2CredentialView as SdkFido2CredentialView,
  Fido2CredentialFullView,
} from "@bitwarden/sdk-internal";

import { ItemView } from "./item.view";

export class Fido2CredentialView extends ItemView {
  credentialId!: string;
  keyType!: "public-key";
  keyAlgorithm!: "ECDSA";
  keyCurve!: "P-256";
  keyValue!: string;
  rpId!: string;
  userHandle?: string;
  userName?: string;
  counter!: number;
  rpName?: string;
  userDisplayName?: string;
  discoverable: boolean = false;
  creationDate!: Date;

  constructor(f?: {
    credentialId: string;
    keyType: "public-key";
    keyAlgorithm: "ECDSA";
    keyCurve: "P-256";
    keyValue: string;
    rpId: string;
    userHandle?: string;
    userName?: string;
    counter: number;
    rpName?: string;
    userDisplayName?: string;
    discoverable?: boolean;
    creationDate: Date;
  }) {
    super();
    if (f == null) {
      return;
    }
    this.credentialId = f.credentialId;
    this.keyType = f.keyType;
    this.keyAlgorithm = f.keyAlgorithm;
    this.keyCurve = f.keyCurve;
    this.keyValue = f.keyValue;
    this.rpId = f.rpId;
    this.userHandle = f.userHandle;
    this.userName = f.userName;
    this.counter = f.counter;
    this.rpName = f.rpName;
    this.userDisplayName = f.userDisplayName;
    this.discoverable = f.discoverable ?? false;
    this.creationDate = f.creationDate;
  }

  get subTitle(): string | undefined {
    return this.userDisplayName;
  }

  static fromJSON(obj: Partial<Jsonify<Fido2CredentialView>>): Fido2CredentialView {
    const creationDate = obj.creationDate != null ? new Date(obj.creationDate) : null;
    return Object.assign(new Fido2CredentialView(), obj, {
      creationDate,
    });
  }

  /**
   * Converts the SDK Fido2CredentialView to a Fido2CredentialView.
   */
  static fromSdkFido2CredentialView(obj: SdkFido2CredentialView): Fido2CredentialView | undefined {
    if (!obj) {
      return undefined;
    }

    return new Fido2CredentialView({
      credentialId: obj.credentialId,
      keyType: obj.keyType as "public-key",
      keyAlgorithm: obj.keyAlgorithm as "ECDSA",
      keyCurve: obj.keyCurve as "P-256",
      keyValue: obj.keyValue,
      rpId: obj.rpId,
      userHandle: obj.userHandle,
      userName: obj.userName,
      counter: parseInt(obj.counter),
      rpName: obj.rpName,
      userDisplayName: obj.userDisplayName,
      discoverable: obj.discoverable?.toLowerCase() === "true",
      creationDate: new Date(obj.creationDate),
    });
  }

  toSdkFido2CredentialFullView(): Fido2CredentialFullView {
    return {
      credentialId: this.credentialId,
      keyType: this.keyType,
      keyAlgorithm: this.keyAlgorithm,
      keyCurve: this.keyCurve,
      keyValue: this.keyValue,
      rpId: this.rpId,
      userHandle: this.userHandle,
      userName: this.userName,
      counter: this.counter.toString(),
      rpName: this.rpName,
      userDisplayName: this.userDisplayName,
      discoverable: this.discoverable ? "true" : "false",
      creationDate: this.creationDate?.toISOString(),
    };
  }
}
