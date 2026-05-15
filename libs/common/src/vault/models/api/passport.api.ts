import { BaseResponse } from "../../../models/response/base.response";

export class PassportApi extends BaseResponse {
  surname: string | undefined = undefined;
  givenName: string | undefined = undefined;
  dateOfBirth: string | undefined = undefined;
  sex: string | undefined = undefined;
  birthPlace: string | undefined = undefined;
  nationality: string | undefined = undefined;
  issuingCountry: string | undefined = undefined;
  passportNumber: string | undefined = undefined;
  passportType: string | undefined = undefined;
  nationalIdentificationNumber: string | undefined = undefined;
  issuingAuthority: string | undefined = undefined;
  issueDate: string | undefined = undefined;
  expirationDate: string | undefined = undefined;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.surname = this.getResponseProperty("Surname");
    this.givenName = this.getResponseProperty("GivenName");
    this.dateOfBirth = this.getResponseProperty("DateOfBirth");
    this.sex = this.getResponseProperty("Sex");
    this.birthPlace = this.getResponseProperty("BirthPlace");
    this.nationality = this.getResponseProperty("Nationality");
    this.issuingCountry = this.getResponseProperty("IssuingCountry");
    this.passportNumber = this.getResponseProperty("PassportNumber");
    this.passportType = this.getResponseProperty("PassportType");
    this.nationalIdentificationNumber = this.getResponseProperty("NationalIdentificationNumber");
    this.issuingAuthority = this.getResponseProperty("IssuingAuthority");
    this.issueDate = this.getResponseProperty("IssueDate");
    this.expirationDate = this.getResponseProperty("ExpirationDate");
  }
}
