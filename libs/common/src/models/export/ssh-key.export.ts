import { EncString } from "../../key-management/crypto/models/enc-string";
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

  static toView(req?: SshKeyExport, view = new SshKeyView()): SshKeyView | undefined {
    if (req == null) {
      return undefined;
    }

    // Only the private key is required; the public key and fingerprint are derived from it at
    // encryption time when absent.
    if (!req.privateKey || req.privateKey.trim() === "") {
      throw new Error("SSH key private key is required.");
    }

    view.privateKey = req.privateKey;
    view.publicKey = req.publicKey;
    view.keyFingerprint = req.keyFingerprint;
    return view;
  }

  static toDomain(req: SshKeyExport, domain = new SshKeyDomain()) {
    domain.privateKey = new EncString(req.privateKey);
    domain.publicKey = new EncString(req.publicKey);
    domain.keyFingerprint = new EncString(req.keyFingerprint);
    return domain;
  }

  privateKey: string = "";
  publicKey: string = "";
  keyFingerprint: string = "";

  constructor(o?: SshKeyView | SshKeyDomain) {
    if (o == null) {
      return;
    }

    this.privateKey = safeGetString(o.privateKey) ?? "";
    this.publicKey = safeGetString(o.publicKey) ?? "";
    this.keyFingerprint = safeGetString(o.keyFingerprint) ?? "";
  }
}
