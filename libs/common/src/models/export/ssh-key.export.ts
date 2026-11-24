import { EncString } from "@bitwarden/sdk-internal";

import { SshKey as SshKeyDomain } from "../../vault/models/domain/ssh-key";
import { SshKeyView as SshKeyView } from "../../vault/models/view/ssh-key.view";

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

    if (!req.privateKey || req.privateKey.trim() === "") {
      throw new Error("SSH key private key is required.");
    }

    view.privateKey = req.privateKey;
    view.publicKey = req.publicKey;
    view.keyFingerprint = req.keyFingerprint;
    return view;
  }

  static toDomain(req: SshKeyExport, domain = new SshKeyDomain()) {
    domain.privateKey = req.privateKey as EncString;
    domain.publicKey = req.publicKey as EncString;
    domain.keyFingerprint = req.keyFingerprint as EncString;
    return domain;
  }

  privateKey: string = "";
  publicKey: string = "";
  keyFingerprint: string = "";

  constructor(o?: SshKeyView | SshKeyDomain) {
    if (o == null) {
      return;
    }

    this.privateKey = o.privateKey ?? "";
    this.publicKey = o.publicKey ?? "";
    this.keyFingerprint = o.keyFingerprint ?? "";
  }
}
