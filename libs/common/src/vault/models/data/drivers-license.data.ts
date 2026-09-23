import { DriversLicenseApi } from "../api/drivers-license.api";

export class DriversLicenseData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  licenseNumber?: string;
  issuingCountry?: string;
  issuingState?: string;
  issueDate?: string;
  expirationDate?: string;
  issuingAuthority?: string;
  licenseClass?: string;

  constructor(data?: DriversLicenseApi) {
    if (data == null) {
      return;
    }

    this.firstName = data.firstName;
    this.middleName = data.middleName;
    this.lastName = data.lastName;
    this.dateOfBirth = data.dateOfBirth;
    this.licenseNumber = data.licenseNumber;
    this.issuingCountry = data.issuingCountry;
    this.issuingState = data.issuingState;
    this.issueDate = data.issueDate;
    this.expirationDate = data.expirationDate;
    this.issuingAuthority = data.issuingAuthority;
    this.licenseClass = data.licenseClass;
  }
}
