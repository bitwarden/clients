import { PassportApi } from "../api/passport.api";

export class PassportData {
  surname?: string;
  givenName?: string;
  dateOfBirth?: string;
  sex?: string;
  birthPlace?: string;
  nationality?: string;
  issuingCountry?: string;
  passportNumber?: string;
  passportType?: string;
  nationalIdentificationNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expirationDate?: string;

  constructor(data?: PassportApi) {
    if (data == null) {
      return;
    }

    this.surname = data.surname;
    this.givenName = data.givenName;
    this.dateOfBirth = data.dateOfBirth;
    this.sex = data.sex;
    this.birthPlace = data.birthPlace;
    this.nationality = data.nationality;
    this.issuingCountry = data.issuingCountry;
    this.passportNumber = data.passportNumber;
    this.passportType = data.passportType;
    this.nationalIdentificationNumber = data.nationalIdentificationNumber;
    this.issuingAuthority = data.issuingAuthority;
    this.issueDate = data.issueDate;
    this.expirationDate = data.expirationDate;
  }
}
