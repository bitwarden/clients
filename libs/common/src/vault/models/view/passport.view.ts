import { Jsonify } from "type-fest";

import { PassportView as SdkPassportView } from "@bitwarden/sdk-internal";

import { ItemView } from "./item.view";

export class PassportView extends ItemView implements SdkPassportView {
  surname: string | undefined;
  givenName: string | undefined;
  dateOfBirth: string | undefined;
  sex: string | undefined;
  birthPlace: string | undefined;
  nationality: string | undefined;
  issuingCountry: string | undefined;
  passportNumber: string | undefined;
  passportType: string | undefined;
  nationalIdentificationNumber: string | undefined;
  issuingAuthority: string | undefined;
  issueDate: string | undefined;
  expirationDate: string | undefined;

  get subTitle(): string {
    const name = [this.givenName, this.surname].filter(Boolean).join(" ");
    const issuingCountry = this.issuingCountry;
    return [name, issuingCountry].filter(Boolean).join(", ");
  }

  static fromJSON(obj: Partial<Jsonify<PassportView>> | undefined): PassportView {
    return Object.assign(new PassportView(), obj);
  }

  static fromSdkPassportView(obj: SdkPassportView): PassportView {
    const view = new PassportView();

    view.surname = obj.surname;
    view.givenName = obj.givenName;
    view.dateOfBirth = obj.dateOfBirth;
    view.sex = obj.sex;
    view.birthPlace = obj.birthPlace;
    view.nationality = obj.nationality;
    view.issuingCountry = obj.issuingCountry;
    view.passportNumber = obj.passportNumber;
    view.passportType = obj.passportType;
    view.nationalIdentificationNumber = obj.nationalIdentificationNumber;
    view.issuingAuthority = obj.issuingAuthority;
    view.issueDate = obj.issueDate;
    view.expirationDate = obj.expirationDate;

    return view;
  }

  toSdkPassportView(): SdkPassportView {
    return this;
  }
}
