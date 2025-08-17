// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionDetailsResponse } from "@bitwarden/admin-console/common";
import { UserDecryptionResponse } from "@bitwarden/common/key-management/models/response/user-decryption.response";

import { PolicyResponse } from "../../admin-console/models/response/policy.response";
import { BaseResponse } from "../../models/response/base.response";
import { DomainsResponse } from "../../models/response/domains.response";
import { ProfileResponse } from "../../models/response/profile.response";
import { SendResponse } from "../../tools/send/models/response/send.response";
import { CipherResponse } from "../../vault/models/response/cipher.response";
import { FolderResponse } from "../../vault/models/response/folder.response";

export class SyncResponse extends BaseResponse {
  profile?: ProfileResponse;
  folders: FolderResponse[] = [];
  collections: CollectionDetailsResponse[] = [];
  ciphers: CipherResponse[] = [];
  domains?: DomainsResponse;
  policies?: PolicyResponse[] = [];
  sends: SendResponse[] = [];
  userDecryption?: UserDecryptionResponse;

  constructor(response: any) {
    super(response);

    const profile = this.getResponseProperty("Profile");
    if (profile != null) {
      this.profile = new ProfileResponse(profile);
    }

    const folders = this.getResponseProperty("Folders");
    if (folders != null) {
      this.folders = folders.map((f: any) => new FolderResponse(f));
    }

    const collections = this.getResponseProperty("Collections");
    if (collections != null) {
      this.collections = collections.map((c: any) => new CollectionDetailsResponse(c));
    }

    const ciphers = this.getResponseProperty("Ciphers");
    if (ciphers != null) {
      this.ciphers = ciphers.map((c: any) => new CipherResponse(c));
    }

    const domains = this.getResponseProperty("Domains");
    if (domains != null) {
      this.domains = new DomainsResponse(domains);
    }

    const policies = this.getResponseProperty("Policies");
    if (policies != null) {
      this.policies = policies.map((p: any) => new PolicyResponse(p));
    }

    const sends = this.getResponseProperty("Sends");
    if (sends != null) {
      this.sends = sends.map((s: any) => new SendResponse(s));
    }

    const userDecryption = this.getResponseProperty("UserDecryption");
    if (userDecryption != null && typeof userDecryption === "object") {
      this.userDecryption = new UserDecryptionResponse(userDecryption);
    }
  }
}
