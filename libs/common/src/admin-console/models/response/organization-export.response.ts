import { BaseResponse } from "../../../models/response/base.response";
import { CipherResponse } from "../../../vault/models/response/cipher.response";
import { CollectionResponse } from "../collections";

export class OrganizationExportResponse extends BaseResponse {
  collections: CollectionResponse[];
  ciphers: CipherResponse[];

  constructor(response: any) {
    super(response);
    const collections = this.getResponseProperty("Collections");
    this.collections =
      collections == null ? [] : collections.map((c: any) => new CollectionResponse(c));
    const ciphers = this.getResponseProperty("Ciphers");
    this.ciphers = ciphers == null ? [] : ciphers.map((c: any) => new CipherResponse(c));
  }
}
