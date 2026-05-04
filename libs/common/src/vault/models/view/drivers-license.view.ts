import { Jsonify } from "type-fest";

import { DriversLicenseView as SdkDriversLicenseView } from "@bitwarden/sdk-internal";

import { ItemView } from "./item.view";

export class DriversLicenseView extends ItemView implements SdkDriversLicenseView {
  firstName: string | undefined;
  middleName: string | undefined;
  lastName: string | undefined;
  dateOfBirth: string | undefined;
  licenseNumber: string | undefined;
  issuingCountry: string | undefined;
  issuingState: string | undefined;
  issueDate: string | undefined;
  expirationDate: string | undefined;
  issuingAuthority: string | undefined;
  licenseClass: string | undefined;

  get subTitle(): string {
    const name = [this.firstName, this.lastName].filter(Boolean).join(" ");
    const issuingState = this.issuingState;
    if (name && issuingState) {
      return `${name}, ${issuingState}`;
    }
    return name || "";
  }

  static fromJSON(obj: Partial<Jsonify<DriversLicenseView>> | undefined): DriversLicenseView {
    return Object.assign(new DriversLicenseView(), obj);
  }

  static fromSdkDriversLicenseView(obj: SdkDriversLicenseView): DriversLicenseView {
    const view = new DriversLicenseView();

    view.firstName = obj.firstName;
    view.middleName = obj.middleName;
    view.lastName = obj.lastName;
    view.dateOfBirth = obj.dateOfBirth;
    view.licenseNumber = obj.licenseNumber;
    view.issuingCountry = obj.issuingCountry;
    view.issuingState = obj.issuingState;
    view.issueDate = obj.issueDate;
    view.expirationDate = obj.expirationDate;
    view.issuingAuthority = obj.issuingAuthority;
    view.licenseClass = obj.licenseClass;

    return view;
  }

  toSdkDriversLicenseView(): SdkDriversLicenseView {
    return this;
  }
}
