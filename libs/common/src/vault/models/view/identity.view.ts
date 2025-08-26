// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { IdentityView as SdkIdentityView } from "@bitwarden/sdk-internal";

import { Utils } from "../../../platform/misc/utils";
import { IdentityLinkedId as LinkedId } from "../../enums";
import { linkedFieldOption } from "../../linked-field-option.decorator";

import { ItemView } from "./item.view";

export class IdentityView extends ItemView implements SdkIdentityView {
  @linkedFieldOption(LinkedId.Title, { sortPosition: 0 })
  title: string = null;
  @linkedFieldOption(LinkedId.MiddleName, { sortPosition: 2 })
  middleName: string = null;
  @linkedFieldOption(LinkedId.Address1, { sortPosition: 12 })
  address1: string = null;
  @linkedFieldOption(LinkedId.Address2, { sortPosition: 13 })
  address2: string = null;
  @linkedFieldOption(LinkedId.Address3, { sortPosition: 14 })
  address3: string = null;
  @linkedFieldOption(LinkedId.City, { sortPosition: 15, i18nKey: "cityTown" })
  city: string = null;
  @linkedFieldOption(LinkedId.State, { sortPosition: 16, i18nKey: "stateProvince" })
  state: string = null;
  @linkedFieldOption(LinkedId.PostalCode, { sortPosition: 17, i18nKey: "zipPostalCode" })
  postalCode: string = null;
  @linkedFieldOption(LinkedId.Country, { sortPosition: 18 })
  country: string = null;
  @linkedFieldOption(LinkedId.Company, { sortPosition: 6 })
  company: string = null;
  @linkedFieldOption(LinkedId.Email, { sortPosition: 10 })
  email: string = null;
  @linkedFieldOption(LinkedId.Phone, { sortPosition: 11 })
  phone: string = null;
  @linkedFieldOption(LinkedId.Ssn, { sortPosition: 7 })
  ssn: string = null;
  @linkedFieldOption(LinkedId.Username, { sortPosition: 5 })
  username: string = null;
  @linkedFieldOption(LinkedId.PassportNumber, { sortPosition: 8 })
  passportNumber: string = null;
  @linkedFieldOption(LinkedId.LicenseNumber, { sortPosition: 9 })
  licenseNumber: string = null;

  private _firstName: string = null;
  private _lastName: string = null;
  private _subTitle: string = null;

  constructor() {
    super();
  }

  @linkedFieldOption(LinkedId.FirstName, { sortPosition: 1 })
  get firstName(): string {
    return this._firstName;
  }
  set firstName(value: string) {
    this._firstName = value;
    this._subTitle = null;
  }

  @linkedFieldOption(LinkedId.LastName, { sortPosition: 4 })
  get lastName(): string {
    return this._lastName;
  }
  set lastName(value: string) {
    this._lastName = value;
    this._subTitle = null;
  }

  get subTitle(): string {
    if (this._subTitle == null && (this.firstName != null || this.lastName != null)) {
      this._subTitle = "";
      if (this.firstName != null) {
        this._subTitle = this.firstName;
      }
      if (this.lastName != null) {
        if (this._subTitle !== "") {
          this._subTitle += " ";
        }
        this._subTitle += this.lastName;
      }
    }

    return this._subTitle;
  }

  @linkedFieldOption(LinkedId.FullName, { sortPosition: 3 })
  get fullName(): string {
    if (
      this.title != null ||
      this.firstName != null ||
      this.middleName != null ||
      this.lastName != null
    ) {
      let name = "";
      if (this.title != null) {
        name += this.title + " ";
      }
      if (this.firstName != null) {
        name += this.firstName + " ";
      }
      if (this.middleName != null) {
        name += this.middleName + " ";
      }
      if (this.lastName != null) {
        name += this.lastName;
      }
      return name.trim();
    }

    return null;
  }

  get fullAddress(): string {
    let address = this.address1;
    if (!Utils.isNullOrWhitespace(this.address2)) {
      if (!Utils.isNullOrWhitespace(address)) {
        address += ", ";
      }
      address += this.address2;
    }
    if (!Utils.isNullOrWhitespace(this.address3)) {
      if (!Utils.isNullOrWhitespace(address)) {
        address += ", ";
      }
      address += this.address3;
    }
    return address;
  }

  get fullAddressPart2(): string {
    if (this.city == null && this.state == null && this.postalCode == null) {
      return null;
    }
    const city = this.city || "-";
    const state = this.state;
    const postalCode = this.postalCode || "-";
    let addressPart2 = city;
    if (!Utils.isNullOrWhitespace(state)) {
      addressPart2 += ", " + state;
    }
    addressPart2 += ", " + postalCode;
    return addressPart2;
  }

  get fullAddressForCopy(): string {
    let address = this.fullAddress;
    if (this.city != null || this.state != null || this.postalCode != null) {
      address += "\n" + this.fullAddressPart2;
    }
    if (this.country != null) {
      address += "\n" + this.country;
    }
    return address;
  }

  static fromJSON(obj: Partial<Jsonify<IdentityView>>): IdentityView {
    return Object.assign(new IdentityView(), obj);
  }

  /**
   * Converts the SDK IdentityView to an IdentityView.
   */
  static fromSdkIdentityView(obj: SdkIdentityView): IdentityView | undefined {
    if (obj == null) {
      return undefined;
    }

    const identityView = new IdentityView();

    identityView.title = obj.title ?? null;
    identityView.firstName = obj.firstName ?? null;
    identityView.middleName = obj.middleName ?? null;
    identityView.lastName = obj.lastName ?? null;
    identityView.address1 = obj.address1 ?? null;
    identityView.address2 = obj.address2 ?? null;
    identityView.address3 = obj.address3 ?? null;
    identityView.city = obj.city ?? null;
    identityView.state = obj.state ?? null;
    identityView.postalCode = obj.postalCode ?? null;
    identityView.country = obj.country ?? null;
    identityView.company = obj.company ?? null;
    identityView.email = obj.email ?? null;
    identityView.phone = obj.phone ?? null;
    identityView.ssn = obj.ssn ?? null;
    identityView.username = obj.username ?? null;
    identityView.passportNumber = obj.passportNumber ?? null;
    identityView.licenseNumber = obj.licenseNumber ?? null;

    return identityView;
  }

  /**
   * Converts the IdentityView to an SDK IdentityView.
   * The view implements the SdkView so we can safely return `this`
   */
  toSdkIdentityView(): SdkIdentityView {
    return this;
  }
}
