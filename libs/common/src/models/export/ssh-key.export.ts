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

  static toView(
    req?: SshKeyExport,
    view = new SshKeyView(),
    allowDerivedKeys = false,
  ): SshKeyView | undefined {
    if (req == null) {
      return undefined;
    }

    if (!req.privateKey || req.privateKey.trim() === "") {
      throw new Error("SSH key private key is required.");
    }

    // The public key and fingerprint are derivable from the private key, but only clients that can
    // derive them may create a key without them. Otherwise older clients fail to decrypt the item.
    if (!allowDerivedKeys) {
      if (!req.publicKey || req.publicKey.trim() === "") {
        throw new Error("SSH key public key is required.");
      }
      if (!req.keyFingerprint || req.keyFingerprint.trim() === "") {
        throw new Error("SSH key fingerprint is required.");
      }
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
