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

  /**
   * Converts the PassportView to an SDK PassportView.
   *
   * Empty strings are normalized to `undefined` so that cleared fields are not encrypted and
   * stored as empty values. The SDK derives `copyableFields` from the presence of each property,
   * so a stored empty string would advertise a copy action for a field that has no value.
   */
  toSdkPassportView(): SdkPassportView {
    return {
      surname: this.surname || undefined,
      givenName: this.givenName || undefined,
      dateOfBirth: this.dateOfBirth || undefined,
      sex: this.sex || undefined,
      birthPlace: this.birthPlace || undefined,
      nationality: this.nationality || undefined,
      issuingCountry: this.issuingCountry || undefined,
      passportNumber: this.passportNumber || undefined,
      passportType: this.passportType || undefined,
      nationalIdentificationNumber: this.nationalIdentificationNumber || undefined,
      issuingAuthority: this.issuingAuthority || undefined,
      issueDate: this.issueDate || undefined,
      expirationDate: this.expirationDate || undefined,
    };
  }
}
