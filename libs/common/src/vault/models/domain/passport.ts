import { Jsonify } from "type-fest";

import { Passport as SdkPassport, EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { PassportData } from "../data/passport.data";

export class Passport extends Domain {
  surname?: EncString;
  givenName?: EncString;
  dateOfBirth?: EncString;
  sex?: EncString;
  birthPlace?: EncString;
  nationality?: EncString;
  issuingCountry?: EncString;
  passportNumber?: EncString;
  passportType?: EncString;
  nationalIdentificationNumber?: EncString;
  issuingAuthority?: EncString;
  issueDate?: EncString;
  expirationDate?: EncString;

  constructor(obj?: PassportData) {
    super();
    if (obj == null) {
      return;
    }

    this.surname = (obj.surname ?? undefined) as EncString;
    this.givenName = (obj.givenName ?? undefined) as EncString;
    this.dateOfBirth = (obj.dateOfBirth ?? undefined) as EncString;
    this.sex = (obj.sex ?? undefined) as EncString;
    this.birthPlace = (obj.birthPlace ?? undefined) as EncString;
    this.nationality = (obj.nationality ?? undefined) as EncString;
    this.issuingCountry = (obj.issuingCountry ?? undefined) as EncString;
    this.passportNumber = (obj.passportNumber ?? undefined) as EncString;
    this.passportType = (obj.passportType ?? undefined) as EncString;
    this.nationalIdentificationNumber = (obj.nationalIdentificationNumber ??
      undefined) as EncString;
    this.issuingAuthority = (obj.issuingAuthority ?? undefined) as EncString;
    this.issueDate = (obj.issueDate ?? undefined) as EncString;
    this.expirationDate = (obj.expirationDate ?? undefined) as EncString;
  }

  toPassportData(): PassportData {
    const c = new PassportData();
    this.buildDataModel(this, c, {
      surname: null,
      givenName: null,
      dateOfBirth: null,
      sex: null,
      birthPlace: null,
      nationality: null,
      issuingCountry: null,
      passportNumber: null,
      passportType: null,
      nationalIdentificationNumber: null,
      issuingAuthority: null,
      issueDate: null,
      expirationDate: null,
    });
    return c;
  }

  static fromJSON(obj: Jsonify<Passport> | undefined): Passport | undefined {
    if (obj == null) {
      return undefined;
    }

    const passport = new Passport();
    passport.surname = obj.surname ?? undefined;
    passport.givenName = obj.givenName ?? undefined;
    passport.dateOfBirth = obj.dateOfBirth ?? undefined;
    passport.sex = obj.sex ?? undefined;
    passport.birthPlace = obj.birthPlace ?? undefined;
    passport.nationality = obj.nationality ?? undefined;
    passport.issuingCountry = obj.issuingCountry ?? undefined;
    passport.passportNumber = obj.passportNumber ?? undefined;
    passport.passportType = obj.passportType ?? undefined;
    passport.nationalIdentificationNumber = obj.nationalIdentificationNumber ?? undefined;
    passport.issuingAuthority = obj.issuingAuthority ?? undefined;
    passport.issueDate = obj.issueDate ?? undefined;
    passport.expirationDate = obj.expirationDate ?? undefined;

    return passport;
  }

  toSdkPassport(): SdkPassport {
    return {
      surname: this.surname ?? undefined,
      givenName: this.givenName ?? undefined,
      dateOfBirth: this.dateOfBirth ?? undefined,
      sex: this.sex ?? undefined,
      birthPlace: this.birthPlace ?? undefined,
      nationality: this.nationality ?? undefined,
      issuingCountry: this.issuingCountry ?? undefined,
      passportNumber: this.passportNumber ?? undefined,
      passportType: this.passportType ?? undefined,
      nationalIdentificationNumber: this.nationalIdentificationNumber ?? undefined,
      issuingAuthority: this.issuingAuthority ?? undefined,
      issueDate: this.issueDate ?? undefined,
      expirationDate: this.expirationDate ?? undefined,
    };
  }

  static fromSdkPassport(obj?: SdkPassport): Passport | undefined {
    if (!obj) {
      return undefined;
    }

    const passport = new Passport();
    passport.surname = obj.surname ?? undefined;
    passport.givenName = obj.givenName ?? undefined;
    passport.dateOfBirth = obj.dateOfBirth ?? undefined;
    passport.sex = obj.sex ?? undefined;
    passport.birthPlace = obj.birthPlace ?? undefined;
    passport.nationality = obj.nationality ?? undefined;
    passport.issuingCountry = obj.issuingCountry ?? undefined;
    passport.passportNumber = obj.passportNumber ?? undefined;
    passport.passportType = obj.passportType ?? undefined;
    passport.nationalIdentificationNumber = obj.nationalIdentificationNumber ?? undefined;
    passport.issuingAuthority = obj.issuingAuthority ?? undefined;
    passport.issueDate = obj.issueDate ?? undefined;
    passport.expirationDate = obj.expirationDate ?? undefined;

    return passport;
  }
}
