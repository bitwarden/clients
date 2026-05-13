import { Jsonify } from "type-fest";

import { DriversLicense as SdkDriversLicense } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
import { DriversLicenseData } from "../data/drivers-license.data";
import { DriversLicenseView } from "../view/drivers-license.view";

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

    this.firstName = conditionalEncString(obj.firstName);
    this.middleName = conditionalEncString(obj.middleName);
    this.lastName = conditionalEncString(obj.lastName);
    this.dateOfBirth = conditionalEncString(obj.dateOfBirth);
    this.licenseNumber = conditionalEncString(obj.licenseNumber);
    this.issuingCountry = conditionalEncString(obj.issuingCountry);
    this.issuingState = conditionalEncString(obj.issuingState);
    this.issueDate = conditionalEncString(obj.issueDate);
    this.expirationDate = conditionalEncString(obj.expirationDate);
    this.issuingAuthority = conditionalEncString(obj.issuingAuthority);
    this.licenseClass = conditionalEncString(obj.licenseClass);
  }

  decrypt(encKey: SymmetricCryptoKey, context = "No Cipher Context"): Promise<DriversLicenseView> {
    return this.decryptObj<DriversLicense, DriversLicenseView>(
      this,
      new DriversLicenseView(),
      [
        "firstName",
        "middleName",
        "lastName",
        "dateOfBirth",
        "licenseNumber",
        "issuingCountry",
        "issuingState",
        "issueDate",
        "expirationDate",
        "issuingAuthority",
        "licenseClass",
      ],
      encKey,
      "DomainType: DriversLicense; " + context,
    );
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
    driversLicense.firstName = encStringFrom(obj.firstName);
    driversLicense.middleName = encStringFrom(obj.middleName);
    driversLicense.lastName = encStringFrom(obj.lastName);
    driversLicense.dateOfBirth = encStringFrom(obj.dateOfBirth);
    driversLicense.licenseNumber = encStringFrom(obj.licenseNumber);
    driversLicense.issuingCountry = encStringFrom(obj.issuingCountry);
    driversLicense.issuingState = encStringFrom(obj.issuingState);
    driversLicense.issueDate = encStringFrom(obj.issueDate);
    driversLicense.expirationDate = encStringFrom(obj.expirationDate);
    driversLicense.issuingAuthority = encStringFrom(obj.issuingAuthority);
    driversLicense.licenseClass = encStringFrom(obj.licenseClass);

    return driversLicense;
  }

  toSdkDriversLicense(): SdkDriversLicense {
    return {
      firstName: this.firstName?.toSdk(),
      middleName: this.middleName?.toSdk(),
      lastName: this.lastName?.toSdk(),
      dateOfBirth: this.dateOfBirth?.toSdk(),
      licenseNumber: this.licenseNumber?.toSdk(),
      issuingCountry: this.issuingCountry?.toSdk(),
      issuingState: this.issuingState?.toSdk(),
      issueDate: this.issueDate?.toSdk(),
      expirationDate: this.expirationDate?.toSdk(),
      issuingAuthority: this.issuingAuthority?.toSdk(),
      licenseClass: this.licenseClass?.toSdk(),
    };
  }

  static fromSdkDriversLicense(obj?: SdkDriversLicense): DriversLicense | undefined {
    if (!obj) {
      return undefined;
    }

    const driversLicense = new DriversLicense();
    driversLicense.firstName = encStringFrom(obj.firstName);
    driversLicense.middleName = encStringFrom(obj.middleName);
    driversLicense.lastName = encStringFrom(obj.lastName);
    driversLicense.dateOfBirth = encStringFrom(obj.dateOfBirth);
    driversLicense.licenseNumber = encStringFrom(obj.licenseNumber);
    driversLicense.issuingCountry = encStringFrom(obj.issuingCountry);
    driversLicense.issuingState = encStringFrom(obj.issuingState);
    driversLicense.issueDate = encStringFrom(obj.issueDate);
    driversLicense.expirationDate = encStringFrom(obj.expirationDate);
    driversLicense.issuingAuthority = encStringFrom(obj.issuingAuthority);
    driversLicense.licenseClass = encStringFrom(obj.licenseClass);

    return driversLicense;
  }
}
