import { BaseResponse } from "../../../../models/response/base.response";

export class OrganizationDomainResponse extends BaseResponse {
  id: string;
  organizationId: string;
  txt: string;
  domainName: string;
  creationDate: string;
  nextRunDate: string;
  jobRunCount: number;
  verifiedDate?: string;
  lastCheckedDate?: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("id");
    this.organizationId = this.getResponseProperty("organizationId");
    this.txt = this.getResponseProperty("txt");
    this.domainName = this.getResponseProperty("domainName");
    this.creationDate = this.getResponseProperty("creationDate");
    this.nextRunDate = this.getResponseProperty("nextRunDate");
    this.jobRunCount = this.getResponseProperty("jobRunCount");
    this.verifiedDate = this.getResponseProperty("verifiedDate");
    this.lastCheckedDate = this.getResponseProperty("lastCheckedDate");
  }
}
