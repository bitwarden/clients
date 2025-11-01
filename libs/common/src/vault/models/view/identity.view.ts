import { Jsonify } from "type-fest";

import { IdentityView as SdkIdentityView } from "@bitwarden/sdk-internal";

import { Utils } from "../../../platform/misc/utils";
import { IdentityLinkedId as LinkedId } from "../../enums";
import { linkedFieldOption } from "../../linked-field-option.decorator";

import { ItemView } from "./item.view";

export class IdentityView extends ItemView implements SdkIdentityView {
  @linkedFieldOption(LinkedId.Title, { sortPosition: 0 })
  title: string | undefined;
  @linkedFieldOption(LinkedId.MiddleName, { sortPosition: 2 })
  middleName: string | undefined;
  @linkedFieldOption(LinkedId.Address1, { sortPosition: 12 })
  address1: string | undefined;
  @linkedFieldOption(LinkedId.Address2, { sortPosition: 13 })
  address2: string | undefined;
  @linkedFieldOption(LinkedId.Address3, { sortPosition: 14 })
  address3: string | undefined;
  @linkedFieldOption(LinkedId.City, { sortPosition: 15, i18nKey: "cityTown" })
  city: string | undefined;
  @linkedFieldOption(LinkedId.State, { sortPosition: 16, i18nKey: "stateProvince" })
  state: string | undefined;
  @linkedFieldOption(LinkedId.PostalCode, { sortPosition: 17, i18nKey: "zipPostalCodeLabel" })
  postalCode: string | undefined;
  @linkedFieldOption(LinkedId.Country, { sortPosition: 18 })
  country: string | undefined;
  @linkedFieldOption(LinkedId.Company, { sortPosition: 6 })
  company: string | undefined;
  @linkedFieldOption(LinkedId.Email, { sortPosition: 10 })
  email: string | undefined;
  @linkedFieldOption(LinkedId.Phone, { sortPosition: 11 })
  phone: string | undefined;
  @linkedFieldOption(LinkedId.Ssn, { sortPosition: 7 })
  ssn: string | undefined;
  @linkedFieldOption(LinkedId.Username, { sortPosition: 5 })
  username: string | undefined;
  @linkedFieldOption(LinkedId.PassportNumber, { sortPosition: 8 })
  passportNumber: string | undefined;
  @linkedFieldOption(LinkedId.LicenseNumber, { sortPosition: 9 })
  licenseNumber: string | undefined;

  private _firstName: string | undefined;
  private _lastName: string | undefined;
  private _subTitle: string | undefined;

  constructor() {
    super();
  }

  @linkedFieldOption(LinkedId.FirstName, { sortPosition: 1 })
  get firstName(): string | undefined {
    return this._firstName;
  }
  set firstName(value: string | undefined) {
    this._firstName = value;
    this._subTitle = undefined;
  }

  @linkedFieldOption(LinkedId.LastName, { sortPosition: 4 })
  get lastName(): string | undefined {
    return this._lastName;
  }
  set lastName(value: string | undefined) {
    this._lastName = value;
    this._subTitle = undefined;
  }

  get subTitle(): string | undefined {
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
  get fullName(): string | undefined {
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

    return undefined;
  }

  get fullAddress(): string | undefined {
    let address = this.address1 ?? "";
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

  get fullAddressPart2(): string | undefined {
    if (this.city == null && this.state == null && this.postalCode == null) {
      return undefined;
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

  get fullAddressForCopy(): string | undefined {
    let address = this.fullAddress;
    if (this.city != null || this.state != null || this.postalCode != null) {
      address += "\n" + this.fullAddressPart2;
    }
    if (this.country != null) {
      address += "\n" + this.country;
    }
    return address;
  }

  static fromJSON(obj: Partial<Jsonify<IdentityView>> | undefined): IdentityView {
    return Object.assign(new IdentityView(), obj);
  }

  /**
   * Converts the SDK IdentityView to an IdentityView.
   */
  static fromSdkIdentityView(obj: SdkIdentityView): IdentityView {
    const identityView = new IdentityView();

    identityView.title = obj.title;
    identityView.firstName = obj.firstName;
    identityView.middleName = obj.middleName;
    identityView.lastName = obj.lastName;
    identityView.address1 = obj.address1;
    identityView.address2 = obj.address2;
    identityView.address3 = obj.address3;
    identityView.city = obj.city;
    identityView.state = obj.state;
    identityView.postalCode = obj.postalCode;
    identityView.country = obj.country;
    identityView.company = obj.company;
    identityView.email = obj.email;
    identityView.phone = obj.phone;
    identityView.ssn = obj.ssn;
    identityView.username = obj.username;
    identityView.passportNumber = obj.passportNumber;
    identityView.licenseNumber = obj.licenseNumber;

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
