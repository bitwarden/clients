// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { EncString } from "../../platform/models/domain/enc-string";
import { SshKey as SshKeyDomain } from "../../vault/models/domain/ssh-key";
import { SshKeyView as SshKeyView } from "../../vault/models/view/ssh-key.view";

import { safeGetString } from "./utils";

export class SshKeyExport {
  static template(): SshKeyExport {
    const req = new SshKeyExport();
    req.privateKey = "";
    req.publicKey = "";
    req.keyFingerprint = "";
    return req;
  }

  static toView(req: SshKeyExport, view = new SshKeyView()) {
    view.privateKey = req.privateKey;
    view.publicKey = req.publicKey;
    view.keyFingerprint = req.keyFingerprint;
    return view;
  }

  static toDomain(req: SshKeyExport, domain = new SshKeyDomain()) {
    domain.privateKey = req.privateKey != null ? new EncString(req.privateKey) : null;
    domain.publicKey = req.publicKey != null ? new EncString(req.publicKey) : null;
    domain.keyFingerprint = req.keyFingerprint != null ? new EncString(req.keyFingerprint) : null;
    return domain;
  }

  privateKey: string;
  publicKey: string;
  keyFingerprint: string;

  constructor(o?: SshKeyView | SshKeyDomain) {
    if (o == null) {
      return;
    }

    this.privateKey = safeGetString(o.privateKey);
    this.publicKey = safeGetString(o.publicKey);
    this.keyFingerprint = safeGetString(o.keyFingerprint);
  }
}
