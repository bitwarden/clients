import { Jsonify } from "type-fest";

import { Identity as SdkIdentity } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
import { IdentityData } from "../data/identity.data";
import { IdentityView } from "../view/identity.view";

export class Identity extends Domain {
  title?: EncString;
  firstName?: EncString;
  middleName?: EncString;
  lastName?: EncString;
  address1?: EncString;
  address2?: EncString;
  address3?: EncString;
  city?: EncString;
  state?: EncString;
  postalCode?: EncString;
  country?: EncString;
  company?: EncString;
  email?: EncString;
  phone?: EncString;
  ssn?: EncString;
  username?: EncString;
  passportNumber?: EncString;
  licenseNumber?: EncString;

  constructor(obj?: IdentityData) {
    super();
    if (obj == null) {
      return;
    }

    this.title = conditionalEncString(obj.title);
    this.firstName = conditionalEncString(obj.firstName);
    this.middleName = conditionalEncString(obj.middleName);
    this.lastName = conditionalEncString(obj.lastName);
    this.address1 = conditionalEncString(obj.address1);
    this.address2 = conditionalEncString(obj.address2);
    this.address3 = conditionalEncString(obj.address3);
    this.city = conditionalEncString(obj.city);
    this.state = conditionalEncString(obj.state);
    this.postalCode = conditionalEncString(obj.postalCode);
    this.country = conditionalEncString(obj.country);
    this.company = conditionalEncString(obj.company);
    this.email = conditionalEncString(obj.email);
    this.phone = conditionalEncString(obj.phone);
    this.ssn = conditionalEncString(obj.ssn);
    this.username = conditionalEncString(obj.username);
    this.passportNumber = conditionalEncString(obj.passportNumber);
    this.licenseNumber = conditionalEncString(obj.licenseNumber);
  }

  decrypt(
    encKey: SymmetricCryptoKey,
    context: string = "No Cipher Context",
  ): Promise<IdentityView> {
    return this.decryptObj<Identity, IdentityView>(
      this,
      new IdentityView(),
      [
        "title",
        "firstName",
        "middleName",
        "lastName",
        "address1",
        "address2",
        "address3",
        "city",
        "state",
        "postalCode",
        "country",
        "company",
        "email",
        "phone",
        "ssn",
        "username",
        "passportNumber",
        "licenseNumber",
      ],
      null,
      encKey,
      "DomainType: Identity; " + context,
    );
  }

  toIdentityData(): IdentityData {
    const i = new IdentityData();
    this.buildDataModel(this, i, {
      title: null,
      firstName: null,
      middleName: null,
      lastName: null,
      address1: null,
      address2: null,
      address3: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      company: null,
      email: null,
      phone: null,
      ssn: null,
      username: null,
      passportNumber: null,
      licenseNumber: null,
    });
    return i;
  }

  static fromJSON(obj: Jsonify<Identity> | undefined): Identity | undefined {
    if (obj == null) {
      return undefined;
    }

    const identity = new Identity();
    identity.title = encStringFrom(obj.title);
    identity.firstName = encStringFrom(obj.firstName);
    identity.middleName = encStringFrom(obj.middleName);
    identity.lastName = encStringFrom(obj.lastName);
    identity.address1 = encStringFrom(obj.address1);
    identity.address2 = encStringFrom(obj.address2);
    identity.address3 = encStringFrom(obj.address3);
    identity.city = encStringFrom(obj.city);
    identity.state = encStringFrom(obj.state);
    identity.postalCode = encStringFrom(obj.postalCode);
    identity.country = encStringFrom(obj.country);
    identity.company = encStringFrom(obj.company);
    identity.email = encStringFrom(obj.email);
    identity.phone = encStringFrom(obj.phone);
    identity.ssn = encStringFrom(obj.ssn);
    identity.username = encStringFrom(obj.username);
    identity.passportNumber = encStringFrom(obj.passportNumber);
    identity.licenseNumber = encStringFrom(obj.licenseNumber);

    return identity;
  }

  /**
   * Maps Identity to SDK format.
   *
   * @returns {SdkIdentity} The SDK identity object.
   */
  toSdkIdentity(): SdkIdentity {
    return {
      title: this.title?.toSdk(),
      firstName: this.firstName?.toSdk(),
      middleName: this.middleName?.toSdk(),
      lastName: this.lastName?.toSdk(),
      address1: this.address1?.toSdk(),
      address2: this.address2?.toSdk(),
      address3: this.address3?.toSdk(),
      city: this.city?.toSdk(),
      state: this.state?.toSdk(),
      postalCode: this.postalCode?.toSdk(),
      country: this.country?.toSdk(),
      company: this.company?.toSdk(),
      email: this.email?.toSdk(),
      phone: this.phone?.toSdk(),
      ssn: this.ssn?.toSdk(),
      username: this.username?.toSdk(),
      passportNumber: this.passportNumber?.toSdk(),
      licenseNumber: this.licenseNumber?.toSdk(),
    };
  }

  /**
   * Maps an SDK Identity object to an Identity
   * @param obj - The SDK Identity object
   */
  static fromSdkIdentity(obj?: SdkIdentity): Identity | undefined {
    if (obj == null) {
      return undefined;
    }

    const identity = new Identity();
    identity.title = encStringFrom(obj.title);
    identity.firstName = encStringFrom(obj.firstName);
    identity.middleName = encStringFrom(obj.middleName);
    identity.lastName = encStringFrom(obj.lastName);
    identity.address1 = encStringFrom(obj.address1);
    identity.address2 = encStringFrom(obj.address2);
    identity.address3 = encStringFrom(obj.address3);
    identity.city = encStringFrom(obj.city);
    identity.state = encStringFrom(obj.state);
    identity.postalCode = encStringFrom(obj.postalCode);
    identity.country = encStringFrom(obj.country);
    identity.company = encStringFrom(obj.company);
    identity.email = encStringFrom(obj.email);
    identity.phone = encStringFrom(obj.phone);
    identity.ssn = encStringFrom(obj.ssn);
    identity.username = encStringFrom(obj.username);
    identity.passportNumber = encStringFrom(obj.passportNumber);
    identity.licenseNumber = encStringFrom(obj.licenseNumber);

    return identity;
  }
}
