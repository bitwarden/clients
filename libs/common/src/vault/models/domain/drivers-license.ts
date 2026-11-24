import { Jsonify } from "type-fest";

import { DriversLicense as SdkDriversLicense, EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { DriversLicenseData } from "../data/drivers-license.data";

export class DriversLicense extends Domain {
  firstName?: EncString;
  middleName?: EncString;
  lastName?: EncString;
  dateOfBirth?: EncString;
  licenseNumber?: EncString;
  issuingCountry?: EncString;
  issuingState?: EncString;
  issueDate?: EncString;
  expirationDate?: EncString;
  issuingAuthority?: EncString;
  licenseClass?: EncString;

  constructor(obj?: DriversLicenseData) {
    super();
    if (obj == null) {
      return;
    }

    this.firstName = (obj.firstName ?? undefined) as EncString;
    this.middleName = (obj.middleName ?? undefined) as EncString;
    this.lastName = (obj.lastName ?? undefined) as EncString;
    this.dateOfBirth = (obj.dateOfBirth ?? undefined) as EncString;
    this.licenseNumber = (obj.licenseNumber ?? undefined) as EncString;
    this.issuingCountry = (obj.issuingCountry ?? undefined) as EncString;
    this.issuingState = (obj.issuingState ?? undefined) as EncString;
    this.issueDate = (obj.issueDate ?? undefined) as EncString;
    this.expirationDate = (obj.expirationDate ?? undefined) as EncString;
    this.issuingAuthority = (obj.issuingAuthority ?? undefined) as EncString;
    this.licenseClass = (obj.licenseClass ?? undefined) as EncString;
  }

  toDriversLicenseData(): DriversLicenseData {
    const c = new DriversLicenseData();
    this.buildDataModel(this, c, {
      firstName: null,
      middleName: null,
      lastName: null,
      dateOfBirth: null,
      licenseNumber: null,
      issuingCountry: null,
      issuingState: null,
      issueDate: null,
      expirationDate: null,
      issuingAuthority: null,
      licenseClass: null,
    });
    return c;
  }

  static fromJSON(obj: Jsonify<DriversLicense> | undefined): DriversLicense | undefined {
    if (obj == null) {
      return undefined;
    }

    const driversLicense = new DriversLicense();
    driversLicense.firstName = obj.firstName ?? undefined;
    driversLicense.middleName = obj.middleName ?? undefined;
    driversLicense.lastName = obj.lastName ?? undefined;
    driversLicense.dateOfBirth = obj.dateOfBirth ?? undefined;
    driversLicense.licenseNumber = obj.licenseNumber ?? undefined;
    driversLicense.issuingCountry = obj.issuingCountry ?? undefined;
    driversLicense.issuingState = obj.issuingState ?? undefined;
    driversLicense.issueDate = obj.issueDate ?? undefined;
    driversLicense.expirationDate = obj.expirationDate ?? undefined;
    driversLicense.issuingAuthority = obj.issuingAuthority ?? undefined;
    driversLicense.licenseClass = obj.licenseClass ?? undefined;

    return driversLicense;
  }

  toSdkDriversLicense(): SdkDriversLicense {
    return {
      firstName: this.firstName ?? undefined,
      middleName: this.middleName ?? undefined,
      lastName: this.lastName ?? undefined,
      dateOfBirth: this.dateOfBirth ?? undefined,
      licenseNumber: this.licenseNumber ?? undefined,
      issuingCountry: this.issuingCountry ?? undefined,
      issuingState: this.issuingState ?? undefined,
      issueDate: this.issueDate ?? undefined,
      expirationDate: this.expirationDate ?? undefined,
      issuingAuthority: this.issuingAuthority ?? undefined,
      licenseClass: this.licenseClass ?? undefined,
    };
  }

  static fromSdkDriversLicense(obj?: SdkDriversLicense): DriversLicense | undefined {
    if (!obj) {
      return undefined;
    }

    const driversLicense = new DriversLicense();
    driversLicense.firstName = obj.firstName ?? undefined;
    driversLicense.middleName = obj.middleName ?? undefined;
    driversLicense.lastName = obj.lastName ?? undefined;
    driversLicense.dateOfBirth = obj.dateOfBirth ?? undefined;
    driversLicense.licenseNumber = obj.licenseNumber ?? undefined;
    driversLicense.issuingCountry = obj.issuingCountry ?? undefined;
    driversLicense.issuingState = obj.issuingState ?? undefined;
    driversLicense.issueDate = obj.issueDate ?? undefined;
    driversLicense.expirationDate = obj.expirationDate ?? undefined;
    driversLicense.issuingAuthority = obj.issuingAuthority ?? undefined;
    driversLicense.licenseClass = obj.licenseClass ?? undefined;

    return driversLicense;
  }
}
