// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { EncString } from "../../key-management/crypto/models/enc-string";
import { SshKey as SshKeyDomain } from "../../vault/models/domain/ssh-key";
import { SshKeyView as SshKeyView } from "../../vault/models/view/ssh-key.view";

import { safeGetString } from "./utils";

export class SshKeyExport {
  static template(): SshKeyExport {
    const req = new SshKeyExport();
    req.privateKey = "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----";
    req.publicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... user@host";
    req.keyFingerprint = "SHA256:abcdef1234567890abcdef1234567890abcdef12";
    return req;
  }

  static toView(req?: SshKeyExport, view = new SshKeyView()): SshKeyView | undefined {
    if (req == null) {
      return undefined;
    }

    // Validate required fields
    if (!req.privateKey || req.privateKey.trim() === "") {
      throw new Error("SSH key private key is required.");
    }
    if (!req.publicKey || req.publicKey.trim() === "") {
      throw new Error("SSH key public key is required.");
    }
    if (!req.keyFingerprint || req.keyFingerprint.trim() === "") {
      throw new Error("SSH key fingerprint is required.");
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
