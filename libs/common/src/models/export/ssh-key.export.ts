// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { import_ssh_key } from "@bitwarden/sdk-internal";

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
    const parsedKey = import_ssh_key(req.privateKey);
    view.privateKey = parsedKey.privateKey;
    view.publicKey = parsedKey.publicKey;
    view.keyFingerprint = parsedKey.fingerprint;
    return view;
  }

  static toDomain(req: SshKeyExport, domain = new SshKeyDomain()) {
    domain.privateKey = new EncString(req.privateKey);
    domain.publicKey = new EncString(req.publicKey);
    domain.keyFingerprint = new EncString(req.keyFingerprint);
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
