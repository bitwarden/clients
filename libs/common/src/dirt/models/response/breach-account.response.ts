import { BaseResponse } from "../../../models/response/base.response";

export class BreachAccountResponse extends BaseResponse {
  addedDate: string;
  breachDate: string;
  dataClasses: string[];
  description: string;
  domain: string;
  isActive: boolean;
  isVerified: boolean;
  logoPath: string;
  modifiedDate: string;
  name: string;
  pwnCount: number;
  title: string;

  constructor(response: any) {
    super(response);
    this.addedDate = this.getResponseProperty("AddedDate");
    this.breachDate = this.getResponseProperty("BreachDate");
    this.dataClasses = this.getResponseProperty("DataClasses");
    this.description = this.getResponseProperty("Description");
    this.domain = this.getResponseProperty("Domain");
    this.isActive = this.getResponseProperty("IsActive");
    this.isVerified = this.getResponseProperty("IsVerified");
    this.logoPath = this.getResponseProperty("LogoPath");
    this.modifiedDate = this.getResponseProperty("ModifiedDate");
    this.name = this.getResponseProperty("Name");
    this.pwnCount = this.getResponseProperty("PwnCount");
    this.title = this.getResponseProperty("Title");
  }
}
