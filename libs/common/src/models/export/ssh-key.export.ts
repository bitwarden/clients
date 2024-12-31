// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SshKeyView as SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import { import_ssh_key } from "@bitwarden/sdk-internal";

import { EncString } from "../../platform/models/domain/enc-string";
import { SshKey as SshKeyDomain } from "../../vault/models/domain/ssh-key";

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
    const parsedKey = import_ssh_key(req.privateKey);
    domain.privateKey = new EncString(parsedKey.private_key);
    domain.publicKey = new EncString(parsedKey.public_key);
    domain.keyFingerprint = new EncString(parsedKey.key_fingerprint);
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
