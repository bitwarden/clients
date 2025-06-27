// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import {
  Fido2CredentialView as SdkFido2CredentialView,
  Fido2CredentialFullView,
} from "@bitwarden/sdk-internal";

import { ItemView } from "./item.view";

export class Fido2CredentialView extends ItemView {
  credentialId: string;
  keyType: "public-key";
  keyAlgorithm: "ECDSA";
  keyCurve: "P-256";
  keyValue: string;
  rpId: string;
  userHandle: string;
  userName: string;
  counter: number;
  rpName: string;
  userDisplayName: string;
  discoverable: boolean;
  creationDate: Date = null;

  get subTitle(): string {
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

    const view = new Fido2CredentialView();
    view.credentialId = obj.credentialId;
    view.keyType = obj.keyType as "public-key";
    view.keyAlgorithm = obj.keyAlgorithm as "ECDSA";
    view.keyCurve = obj.keyCurve as "P-256";
    view.rpId = obj.rpId;
    view.userHandle = obj.userHandle;
    view.userName = obj.userName;
    view.counter = parseInt(obj.counter);
    view.rpName = obj.rpName;
    view.userDisplayName = obj.userDisplayName;
    view.discoverable = obj.discoverable?.toLowerCase() === "true" ? true : false;
    view.creationDate = obj.creationDate ? new Date(obj.creationDate) : null;

    return view;
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
