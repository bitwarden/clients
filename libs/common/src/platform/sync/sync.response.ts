import { CollectionDetailsResponse } from "@bitwarden/common/admin-console/models/collections";

import { PolicyResponse } from "../../admin-console/models/response/policy.response";
import { UserDecryptionResponse } from "../../key-management/models/response/user-decryption.response";
import { BaseResponse } from "../../models/response/base.response";
import { DomainsResponse } from "../../models/response/domains.response";
import { ProfileResponse } from "../../models/response/profile.response";
import { SendResponse } from "../../tools/send/models/response/send.response";
import { AlertExclusionResponse } from "../../vault/models/response/alert-exclusion.response";
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
  alertExclusions: AlertExclusionResponse[] = [];

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

    // Wire format: server JSON property is "AlertDismissals" (legacy server contract).
    const alertExclusions = this.getResponseProperty("AlertDismissals");
    if (alertExclusions != null) {
      this.alertExclusions = alertExclusions.map((d: any) => new AlertExclusionResponse(d));
    }
  }
}
