import { Jsonify } from "type-fest";

import { Identity as SdkIdentity, EncString } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { IdentityData } from "../data/identity.data";

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

    this.title = (obj.title ?? undefined) as EncString;
    this.firstName = (obj.firstName ?? undefined) as EncString;
    this.middleName = (obj.middleName ?? undefined) as EncString;
    this.lastName = (obj.lastName ?? undefined) as EncString;
    this.address1 = (obj.address1 ?? undefined) as EncString;
    this.address2 = (obj.address2 ?? undefined) as EncString;
    this.address3 = (obj.address3 ?? undefined) as EncString;
    this.city = (obj.city ?? undefined) as EncString;
    this.state = (obj.state ?? undefined) as EncString;
    this.postalCode = (obj.postalCode ?? undefined) as EncString;
    this.country = (obj.country ?? undefined) as EncString;
    this.company = (obj.company ?? undefined) as EncString;
    this.email = (obj.email ?? undefined) as EncString;
    this.phone = (obj.phone ?? undefined) as EncString;
    this.ssn = (obj.ssn ?? undefined) as EncString;
    this.username = (obj.username ?? undefined) as EncString;
    this.passportNumber = (obj.passportNumber ?? undefined) as EncString;
    this.licenseNumber = (obj.licenseNumber ?? undefined) as EncString;
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
    identity.title = obj.title ?? undefined;
    identity.firstName = obj.firstName ?? undefined;
    identity.middleName = obj.middleName ?? undefined;
    identity.lastName = obj.lastName ?? undefined;
    identity.address1 = obj.address1 ?? undefined;
    identity.address2 = obj.address2 ?? undefined;
    identity.address3 = obj.address3 ?? undefined;
    identity.city = obj.city ?? undefined;
    identity.state = obj.state ?? undefined;
    identity.postalCode = obj.postalCode ?? undefined;
    identity.country = obj.country ?? undefined;
    identity.company = obj.company ?? undefined;
    identity.email = obj.email ?? undefined;
    identity.phone = obj.phone ?? undefined;
    identity.ssn = obj.ssn ?? undefined;
    identity.username = obj.username ?? undefined;
    identity.passportNumber = obj.passportNumber ?? undefined;
    identity.licenseNumber = obj.licenseNumber ?? undefined;

    return identity;
  }

  /**
   * Maps Identity to SDK format.
   *
   * @returns {SdkIdentity} The SDK identity object.
   */
  toSdkIdentity(): SdkIdentity {
    return {
      title: this.title ?? undefined,
      firstName: this.firstName ?? undefined,
      middleName: this.middleName ?? undefined,
      lastName: this.lastName ?? undefined,
      address1: this.address1 ?? undefined,
      address2: this.address2 ?? undefined,
      address3: this.address3 ?? undefined,
      city: this.city ?? undefined,
      state: this.state ?? undefined,
      postalCode: this.postalCode ?? undefined,
      country: this.country ?? undefined,
      company: this.company ?? undefined,
      email: this.email ?? undefined,
      phone: this.phone ?? undefined,
      ssn: this.ssn ?? undefined,
      username: this.username ?? undefined,
      passportNumber: this.passportNumber ?? undefined,
      licenseNumber: this.licenseNumber ?? undefined,
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
    identity.title = obj.title ?? undefined;
    identity.firstName = obj.firstName ?? undefined;
    identity.middleName = obj.middleName ?? undefined;
    identity.lastName = obj.lastName ?? undefined;
    identity.address1 = obj.address1 ?? undefined;
    identity.address2 = obj.address2 ?? undefined;
    identity.address3 = obj.address3 ?? undefined;
    identity.city = obj.city ?? undefined;
    identity.state = obj.state ?? undefined;
    identity.postalCode = obj.postalCode ?? undefined;
    identity.country = obj.country ?? undefined;
    identity.company = obj.company ?? undefined;
    identity.email = obj.email ?? undefined;
    identity.phone = obj.phone ?? undefined;
    identity.ssn = obj.ssn ?? undefined;
    identity.username = obj.username ?? undefined;
    identity.passportNumber = obj.passportNumber ?? undefined;
    identity.licenseNumber = obj.licenseNumber ?? undefined;

    return identity;
  }
}
