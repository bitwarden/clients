import { Jsonify } from "type-fest";

import { Passport as SdkPassport } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
import { PassportData } from "../data/passport.data";
import { PassportView } from "../view/passport.view";

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

    this.surname = conditionalEncString(obj.surname);
    this.givenName = conditionalEncString(obj.givenName);
    this.dateOfBirth = conditionalEncString(obj.dateOfBirth);
    this.sex = conditionalEncString(obj.sex);
    this.birthPlace = conditionalEncString(obj.birthPlace);
    this.nationality = conditionalEncString(obj.nationality);
    this.issuingCountry = conditionalEncString(obj.issuingCountry);
    this.passportNumber = conditionalEncString(obj.passportNumber);
    this.passportType = conditionalEncString(obj.passportType);
    this.nationalIdentificationNumber = conditionalEncString(obj.nationalIdentificationNumber);
    this.issuingAuthority = conditionalEncString(obj.issuingAuthority);
    this.issueDate = conditionalEncString(obj.issueDate);
    this.expirationDate = conditionalEncString(obj.expirationDate);
  }

  decrypt(encKey: SymmetricCryptoKey, context = "No Cipher Context"): Promise<PassportView> {
    return this.decryptObj<Passport, PassportView>(
      this,
      new PassportView(),
      [
        "surname",
        "givenName",
        "dateOfBirth",
        "sex",
        "birthPlace",
        "nationality",
        "issuingCountry",
        "passportNumber",
        "passportType",
        "nationalIdentificationNumber",
        "issuingAuthority",
        "issueDate",
        "expirationDate",
      ],
      encKey,
      "DomainType: Passport; " + context,
    );
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
    passport.surname = encStringFrom(obj.surname);
    passport.givenName = encStringFrom(obj.givenName);
    passport.dateOfBirth = encStringFrom(obj.dateOfBirth);
    passport.sex = encStringFrom(obj.sex);
    passport.birthPlace = encStringFrom(obj.birthPlace);
    passport.nationality = encStringFrom(obj.nationality);
    passport.issuingCountry = encStringFrom(obj.issuingCountry);
    passport.passportNumber = encStringFrom(obj.passportNumber);
    passport.passportType = encStringFrom(obj.passportType);
    passport.nationalIdentificationNumber = encStringFrom(obj.nationalIdentificationNumber);
    passport.issuingAuthority = encStringFrom(obj.issuingAuthority);
    passport.issueDate = encStringFrom(obj.issueDate);
    passport.expirationDate = encStringFrom(obj.expirationDate);

    return passport;
  }

  toSdkPassport(): SdkPassport {
    return {
      surname: this.surname?.toSdk(),
      givenName: this.givenName?.toSdk(),
      dateOfBirth: this.dateOfBirth?.toSdk(),
      sex: this.sex?.toSdk(),
      birthPlace: this.birthPlace?.toSdk(),
      nationality: this.nationality?.toSdk(),
      issuingCountry: this.issuingCountry?.toSdk(),
      passportNumber: this.passportNumber?.toSdk(),
      passportType: this.passportType?.toSdk(),
      nationalIdentificationNumber: this.nationalIdentificationNumber?.toSdk(),
      issuingAuthority: this.issuingAuthority?.toSdk(),
      issueDate: this.issueDate?.toSdk(),
      expirationDate: this.expirationDate?.toSdk(),
    };
  }

  static fromSdkPassport(obj?: SdkPassport): Passport | undefined {
    if (!obj) {
      return undefined;
    }

    const passport = new Passport();
    passport.surname = encStringFrom(obj.surname);
    passport.givenName = encStringFrom(obj.givenName);
    passport.dateOfBirth = encStringFrom(obj.dateOfBirth);
    passport.sex = encStringFrom(obj.sex);
    passport.birthPlace = encStringFrom(obj.birthPlace);
    passport.nationality = encStringFrom(obj.nationality);
    passport.issuingCountry = encStringFrom(obj.issuingCountry);
    passport.passportNumber = encStringFrom(obj.passportNumber);
    passport.passportType = encStringFrom(obj.passportType);
    passport.nationalIdentificationNumber = encStringFrom(obj.nationalIdentificationNumber);
    passport.issuingAuthority = encStringFrom(obj.issuingAuthority);
    passport.issueDate = encStringFrom(obj.issueDate);
    passport.expirationDate = encStringFrom(obj.expirationDate);

    return passport;
  }
}
