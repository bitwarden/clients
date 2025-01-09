// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionResponse } from "@bitwarden/admin-console/common";

import { BaseResponse } from "../../../models/response/base.response";
import { CipherResponse } from "../../../vault/models/response/cipher.response";

export class OrganizationExportResponse extends BaseResponse {
  collections: CollectionResponse[];
  ciphers: CipherResponse[];

  constructor(response: any) {
    super(response);
    const collections = this.getResponseProperty("Collections");
    if (collections != null) {
      this.collections = collections.map((c: any) => new CollectionResponse(c));
    }
    const ciphers = this.getResponseProperty("Ciphers");
    if (ciphers != null) {
      this.ciphers = ciphers.map((c: any) => new CipherResponse(c));
    }
  }
}
