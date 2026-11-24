import { EncString } from "@bitwarden/sdk-internal";

import { Passport as PassportDomain } from "../../vault/models/domain/passport";
import { PassportView } from "../../vault/models/view/passport.view";

export class PassportExport {
  static template(): PassportExport {
    const req = new PassportExport();
    req.surname = "Smith";
    req.givenName = "Jane";
    req.dateOfBirth = "1990-01-15";
    req.sex = "F";
    req.birthPlace = "Los Angeles, CA";
    req.nationality = "USA";
    req.issuingCountry = "US";
    req.passportNumber = "A12345678";
    req.passportType = "P";
    req.nationalIdentificationNumber = "123-45-6789";
    req.issuingAuthority = "U.S. Department of State";
    req.issueDate = "2020-06-01";
    req.expirationDate = "2030-06-01";
    return req;
  }

  static toView(req?: PassportExport, view = new PassportView()): PassportView | undefined {
    if (req == null) {
      return undefined;
    }

    view.surname = req.surname;
    view.givenName = req.givenName;
    view.dateOfBirth = req.dateOfBirth;
    view.sex = req.sex;
    view.birthPlace = req.birthPlace;
    view.nationality = req.nationality;
    view.issuingCountry = req.issuingCountry;
    view.passportNumber = req.passportNumber;
    view.passportType = req.passportType;
    view.nationalIdentificationNumber = req.nationalIdentificationNumber;
    view.issuingAuthority = req.issuingAuthority;
    view.issueDate = req.issueDate;
    view.expirationDate = req.expirationDate;
    return view;
  }

  static toDomain(req: PassportExport, domain = new PassportDomain()) {
    domain.surname = req.surname ? (req.surname as EncString) : undefined;
    domain.givenName = req.givenName ? (req.givenName as EncString) : undefined;
    domain.dateOfBirth = req.dateOfBirth ? (req.dateOfBirth as EncString) : undefined;
    domain.sex = req.sex ? (req.sex as EncString) : undefined;
    domain.birthPlace = req.birthPlace ? (req.birthPlace as EncString) : undefined;
    domain.nationality = req.nationality ? (req.nationality as EncString) : undefined;
    domain.issuingCountry = req.issuingCountry ? (req.issuingCountry as EncString) : undefined;
    domain.passportNumber = req.passportNumber ? (req.passportNumber as EncString) : undefined;
    domain.passportType = req.passportType ? (req.passportType as EncString) : undefined;
    domain.nationalIdentificationNumber = req.nationalIdentificationNumber
      ? (req.nationalIdentificationNumber as EncString)
      : undefined;
    domain.issuingAuthority = req.issuingAuthority
      ? (req.issuingAuthority as EncString)
      : undefined;
    domain.issueDate = req.issueDate ? (req.issueDate as EncString) : undefined;
    domain.expirationDate = req.expirationDate ? (req.expirationDate as EncString) : undefined;
    return domain;
  }

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

  constructor(o?: PassportView | PassportDomain) {
    if (o == null) {
      return;
    }

    this.surname = o.surname ?? undefined;
    this.givenName = o.givenName ?? undefined;
    this.dateOfBirth = o.dateOfBirth ?? undefined;
    this.sex = o.sex ?? undefined;
    this.birthPlace = o.birthPlace ?? undefined;
    this.nationality = o.nationality ?? undefined;
    this.issuingCountry = o.issuingCountry ?? undefined;
    this.passportNumber = o.passportNumber ?? undefined;
    this.passportType = o.passportType ?? undefined;
    this.nationalIdentificationNumber = o.nationalIdentificationNumber ?? undefined;
    this.issuingAuthority = o.issuingAuthority ?? undefined;
    this.issueDate = o.issueDate ?? undefined;
    this.expirationDate = o.expirationDate ?? undefined;
  }
}
