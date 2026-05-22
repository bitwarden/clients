import { EncString } from "../../key-management/crypto/models/enc-string";
import { Passport as PassportDomain } from "../../vault/models/domain/passport";
import { PassportView } from "../../vault/models/view/passport.view";

import { safeGetString } from "./utils";

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
    domain.surname = req.surname ? new EncString(req.surname) : undefined;
    domain.givenName = req.givenName ? new EncString(req.givenName) : undefined;
    domain.dateOfBirth = req.dateOfBirth ? new EncString(req.dateOfBirth) : undefined;
    domain.sex = req.sex ? new EncString(req.sex) : undefined;
    domain.birthPlace = req.birthPlace ? new EncString(req.birthPlace) : undefined;
    domain.nationality = req.nationality ? new EncString(req.nationality) : undefined;
    domain.issuingCountry = req.issuingCountry ? new EncString(req.issuingCountry) : undefined;
    domain.passportNumber = req.passportNumber ? new EncString(req.passportNumber) : undefined;
    domain.passportType = req.passportType ? new EncString(req.passportType) : undefined;
    domain.nationalIdentificationNumber = req.nationalIdentificationNumber
      ? new EncString(req.nationalIdentificationNumber)
      : undefined;
    domain.issuingAuthority = req.issuingAuthority
      ? new EncString(req.issuingAuthority)
      : undefined;
    domain.issueDate = req.issueDate ? new EncString(req.issueDate) : undefined;
    domain.expirationDate = req.expirationDate ? new EncString(req.expirationDate) : undefined;
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

    this.surname = safeGetString(o.surname);
    this.givenName = safeGetString(o.givenName);
    this.dateOfBirth = safeGetString(o.dateOfBirth);
    this.sex = safeGetString(o.sex);
    this.birthPlace = safeGetString(o.birthPlace);
    this.nationality = safeGetString(o.nationality);
    this.issuingCountry = safeGetString(o.issuingCountry);
    this.passportNumber = safeGetString(o.passportNumber);
    this.passportType = safeGetString(o.passportType);
    this.nationalIdentificationNumber = safeGetString(o.nationalIdentificationNumber);
    this.issuingAuthority = safeGetString(o.issuingAuthority);
    this.issueDate = safeGetString(o.issueDate);
    this.expirationDate = safeGetString(o.expirationDate);
  }
}
