import { BaseResponse } from "../../../models/response/base.response";

export class DriversLicenseApi extends BaseResponse {
  firstName: string | undefined = undefined;
  middleName: string | undefined = undefined;
  lastName: string | undefined = undefined;
  dateOfBirth: string | undefined = undefined;
  licenseNumber: string | undefined = undefined;
  issuingCountry: string | undefined = undefined;
  issuingState: string | undefined = undefined;
  issueDate: string | undefined = undefined;
  expirationDate: string | undefined = undefined;
  issuingAuthority: string | undefined = undefined;
  licenseClass: string | undefined = undefined;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.firstName = this.getResponseProperty("FirstName");
    this.middleName = this.getResponseProperty("MiddleName");
    this.lastName = this.getResponseProperty("LastName");
    this.dateOfBirth = this.getResponseProperty("DateOfBirth");
    this.licenseNumber = this.getResponseProperty("LicenseNumber");
    this.issuingCountry = this.getResponseProperty("IssuingCountry");
    this.issuingState = this.getResponseProperty("IssuingState");
    this.issueDate = this.getResponseProperty("IssueDate");
    this.expirationDate = this.getResponseProperty("ExpirationDate");
    this.issuingAuthority = this.getResponseProperty("IssuingAuthority");
    this.licenseClass = this.getResponseProperty("LicenseClass");
  }
}
