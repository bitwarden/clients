import { EncString } from "@bitwarden/sdk-internal";

import { DriversLicense as DriversLicenseDomain } from "../../vault/models/domain/drivers-license";
import { DriversLicenseView } from "../../vault/models/view/drivers-license.view";

export class DriversLicenseExport {
  static template(): DriversLicenseExport {
    const req = new DriversLicenseExport();
    req.firstName = "Jane";
    req.middleName = "A.";
    req.lastName = "Smith";
    req.dateOfBirth = "1990-01-15";
    req.licenseNumber = "D12345678";
    req.issuingCountry = "US";
    req.issuingState = "CA";
    req.issueDate = "2020-06-01";
    req.expirationDate = "2028-06-01";
    req.issuingAuthority = "California DMV";
    req.licenseClass = "C";
    return req;
  }

  static toView(
    req?: DriversLicenseExport,
    view = new DriversLicenseView(),
  ): DriversLicenseView | undefined {
    if (req == null) {
      return undefined;
    }

    view.firstName = req.firstName;
    view.middleName = req.middleName;
    view.lastName = req.lastName;
    view.dateOfBirth = req.dateOfBirth;
    view.licenseNumber = req.licenseNumber;
    view.issuingCountry = req.issuingCountry;
    view.issuingState = req.issuingState;
    view.issueDate = req.issueDate;
    view.expirationDate = req.expirationDate;
    view.issuingAuthority = req.issuingAuthority;
    view.licenseClass = req.licenseClass;
    return view;
  }

  static toDomain(req: DriversLicenseExport, domain = new DriversLicenseDomain()) {
    domain.firstName = req.firstName ? (req.firstName as EncString) : undefined;
    domain.middleName = req.middleName ? (req.middleName as EncString) : undefined;
    domain.lastName = req.lastName ? (req.lastName as EncString) : undefined;
    domain.dateOfBirth = req.dateOfBirth ? (req.dateOfBirth as EncString) : undefined;
    domain.licenseNumber = req.licenseNumber ? (req.licenseNumber as EncString) : undefined;
    domain.issuingCountry = req.issuingCountry ? (req.issuingCountry as EncString) : undefined;
    domain.issuingState = req.issuingState ? (req.issuingState as EncString) : undefined;
    domain.issueDate = req.issueDate ? (req.issueDate as EncString) : undefined;
    domain.expirationDate = req.expirationDate ? (req.expirationDate as EncString) : undefined;
    domain.issuingAuthority = req.issuingAuthority
      ? (req.issuingAuthority as EncString)
      : undefined;
    domain.licenseClass = req.licenseClass ? (req.licenseClass as EncString) : undefined;
    return domain;
  }

  firstName: string | undefined = undefined;
  middleName: string | undefined = undefined;
  lastName: string | undefined = undefined;
  dateOfBirth: string | undefined = undefined;
  licenseNumber: string | undefined = undefined;
  issuingCountry: string | undefined = undefined;
  issuingState: string | undefined = undefined;
  issueDate: string | undefined = undefined;
  expirationDate: string | undefined = undefined;
  issuingAuthority: string | undefined = undefined;
  licenseClass: string | undefined = undefined;

  constructor(o?: DriversLicenseView | DriversLicenseDomain) {
    if (o == null) {
      return;
    }

    this.firstName = o.firstName ?? undefined;
    this.middleName = o.middleName ?? undefined;
    this.lastName = o.lastName ?? undefined;
    this.dateOfBirth = o.dateOfBirth ?? undefined;
    this.licenseNumber = o.licenseNumber ?? undefined;
    this.issuingCountry = o.issuingCountry ?? undefined;
    this.issuingState = o.issuingState ?? undefined;
    this.issueDate = o.issueDate ?? undefined;
    this.expirationDate = o.expirationDate ?? undefined;
    this.issuingAuthority = o.issuingAuthority ?? undefined;
    this.licenseClass = o.licenseClass ?? undefined;
  }
}
