import { EncString } from "../../key-management/crypto/models/enc-string";
import { Fido2Credential } from "../../vault/models/domain/fido2-credential";
import { Fido2CredentialView } from "../../vault/models/view/fido2-credential.view";

import { safeGetString } from "./utils";

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
    domain.credentialId = new EncString(req.credentialId ?? "");
    domain.keyType = new EncString(req.keyType ?? "");
    domain.keyAlgorithm = new EncString(req.keyAlgorithm ?? "");
    domain.keyCurve = new EncString(req.keyCurve ?? "");
    domain.keyValue = new EncString(req.keyValue ?? "");
    domain.rpId = new EncString(req.rpId ?? "");
    domain.userHandle = new EncString(req.userHandle ?? "");
    domain.userName = new EncString(req.userName ?? "");
    domain.counter = new EncString(req.counter ?? "");
    domain.rpName = new EncString(req.rpName ?? "");
    domain.userDisplayName = new EncString(req.userDisplayName ?? "");
    domain.discoverable = new EncString(req.discoverable ?? "");
    domain.creationDate = req.creationDate;
    return domain;
  }

  credentialId: string = "";
  keyType: string = "";
  keyAlgorithm: string = "";
  keyCurve: string = "";
  keyValue: string = "";
  rpId: string = "";
  userHandle: string = "";
  userName: string = "";
  counter: string = "";
  rpName: string = "";
  userDisplayName: string = "";
  discoverable: string = "";
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

    this.credentialId = safeGetString(o.credentialId) ?? "";
    this.keyType = safeGetString(o.keyType) ?? "";
    this.keyAlgorithm = safeGetString(o.keyAlgorithm) ?? "";
    this.keyCurve = safeGetString(o.keyCurve) ?? "";
    this.keyValue = safeGetString(o.keyValue) ?? "";
    this.rpId = safeGetString(o.rpId) ?? "";
    this.userHandle = safeGetString(o.userHandle ?? "") ?? "";
    this.userName = safeGetString(o.userName ?? "") ?? "";
    this.counter = safeGetString(String(o.counter)) ?? "";
    this.rpName = safeGetString(o.rpName ?? "") ?? "";
    this.userDisplayName = safeGetString(o.userDisplayName ?? "") ?? "";
    this.discoverable = safeGetString(String(o.discoverable)) ?? "";
    this.creationDate = o.creationDate;
  }
}
