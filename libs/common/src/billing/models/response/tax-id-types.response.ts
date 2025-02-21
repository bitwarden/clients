import { BaseResponse } from "../../../models/response/base.response";

export class TaxIdTypesResponse extends BaseResponse {
  taxIdTypes: TaxIdTypeResponse[] = [];

  constructor(response: any) {
    super(response);
    const taxIdTypes = this.getResponseProperty("TaxIdTypes");
    if (taxIdTypes && taxIdTypes.length) {
      this.taxIdTypes = taxIdTypes.map((t: any) => new TaxIdTypeResponse(t));
    }
  }
}

export class TaxIdTypeResponse extends BaseResponse {
  code: string;
  country: string;
  description: string;
  example: string;

  constructor(response: any) {
    super(response);
    this.code = this.getResponseProperty("Code");
    this.country = this.getResponseProperty("Country");
    this.description = this.getResponseProperty("Description");
    this.example = this.getResponseProperty("Example");
  }
}
