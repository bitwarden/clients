import { EncString } from "@bitwarden/sdk-internal";

import { Fido2Credential } from "../../vault/models/domain/fido2-credential";
import { Fido2CredentialView } from "../../vault/models/view/fido2-credential.view";

/**
 * Represents format of Fido2 Credentials in JSON exports.
 */
export class Fido2CredentialExport {
  /**
   * Generates a template for Fido2CredentialExport
   * @returns Instance of Fido2CredentialExport with predefined values.
   */
  static template(): Fido2CredentialExport {
    const req = new Fido2CredentialExport();
    req.credentialId = "keyId";
    req.keyType = "keyType";
    req.keyAlgorithm = "keyAlgorithm";
    req.keyCurve = "keyCurve";
    req.keyValue = "keyValue";
    req.rpId = "rpId";
    req.userHandle = "userHandle";
    req.userName = "userName";
    req.counter = "counter";
    req.rpName = "rpName";
    req.userDisplayName = "userDisplayName";
    req.discoverable = "false";
    req.creationDate = new Date();
    return req;
  }

  /**
   * Converts a Fido2CredentialExport object to its view representation.
   * @param req - The Fido2CredentialExport object to be converted.
   * @param view - (Optional) The Fido2CredentialView object to popualte with Fido2CredentialExport data
   * @returns Fido2CredentialView - The populated view, or a new instance if none was provided.
   */
  static toView(req: Fido2CredentialExport, view = new Fido2CredentialView()) {
    view.credentialId = req.credentialId;
    view.keyType = req.keyType as "public-key";
    view.keyAlgorithm = req.keyAlgorithm as "ECDSA";
    view.keyCurve = req.keyCurve as "P-256";
    view.keyValue = req.keyValue;
    view.rpId = req.rpId;
    view.userHandle = req.userHandle;
    view.userName = req.userName;
    view.counter = parseInt(req.counter);
    view.rpName = req.rpName;
    view.userDisplayName = req.userDisplayName;
    view.discoverable = req.discoverable === "true";
    view.creationDate = new Date(req.creationDate);
    return view;
  }

  /**
   * Converts a Fido2CredentialExport object to its domain representation.
   * @param req - The Fido2CredentialExport object to be converted.
   * @param domain - (Optional) The Fido2Credential object to popualte with Fido2CredentialExport data
   * @returns Fido2Credential - The populated domain, or a new instance if none was provided.
   */
  static toDomain(req: Fido2CredentialExport, domain = new Fido2Credential()) {
    domain.credentialId = req.credentialId as EncString;
    domain.keyType = req.keyType as EncString;
    domain.keyAlgorithm = req.keyAlgorithm as EncString;
    domain.keyCurve = req.keyCurve as EncString;
    domain.keyValue = req.keyValue as EncString;
    domain.rpId = req.rpId as EncString;
    domain.userHandle = req.userHandle != null ? (req.userHandle as EncString) : undefined;
    domain.userName = req.userName != null ? (req.userName as EncString) : undefined;
    domain.counter = req.counter as EncString;
    domain.rpName = req.rpName != null ? (req.rpName as EncString) : undefined;
    domain.userDisplayName =
      req.userDisplayName != null ? (req.userDisplayName as EncString) : undefined;
    domain.discoverable = req.discoverable as EncString;
    domain.creationDate = new Date(req.creationDate);
    return domain;
  }

  credentialId: string = "";
  keyType: string = "";
  keyAlgorithm: string = "";
  keyCurve: string = "";
  keyValue: string = "";
  rpId: string = "";
  userHandle?: string;
  userName?: string;
  counter: string = "";
  rpName?: string;
  userDisplayName?: string;
  discoverable: string = "false";
  creationDate: Date = new Date();

  /**
   * Constructs a new Fid2CredentialExport instance.
   *
   * @param o - The credential storing the data being exported. When not provided, an empty export is created instead.
   */
  constructor(o?: Fido2CredentialView | Fido2Credential) {
    if (o == null) {
      return;
    }

    this.credentialId = o.credentialId ?? "";
    this.keyType = o.keyType ?? "";
    this.keyAlgorithm = o.keyAlgorithm ?? "";
    this.keyCurve = o.keyCurve ?? "";
    this.keyValue = o.keyValue ?? "";
    this.rpId = o.rpId ?? "";
    this.userHandle = o.userHandle ?? undefined;
    this.userName = o.userName ?? undefined;
    this.counter = (o instanceof Fido2CredentialView ? String(o.counter) : o.counter) ?? "";
    this.rpName = o.rpName ?? undefined;
    this.userDisplayName = o.userDisplayName ?? undefined;
    this.discoverable =
      (o instanceof Fido2CredentialView ? String(o.discoverable) : o.discoverable) ?? "false";
    this.creationDate = o.creationDate;
  }
}
