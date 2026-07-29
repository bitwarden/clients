import { EncString } from "../../key-management/crypto/models/enc-string";
import { DriversLicense as DriversLicenseDomain } from "../../vault/models/domain/drivers-license";
import { DriversLicenseView } from "../../vault/models/view/drivers-license.view";

import { safeGetString } from "./utils";

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
    domain.firstName = req.firstName ? new EncString(req.firstName) : undefined;
    domain.middleName = req.middleName ? new EncString(req.middleName) : undefined;
    domain.lastName = req.lastName ? new EncString(req.lastName) : undefined;
    domain.dateOfBirth = req.dateOfBirth ? new EncString(req.dateOfBirth) : undefined;
    domain.licenseNumber = req.licenseNumber ? new EncString(req.licenseNumber) : undefined;
    domain.issuingCountry = req.issuingCountry ? new EncString(req.issuingCountry) : undefined;
    domain.issuingState = req.issuingState ? new EncString(req.issuingState) : undefined;
    domain.issueDate = req.issueDate ? new EncString(req.issueDate) : undefined;
    domain.expirationDate = req.expirationDate ? new EncString(req.expirationDate) : undefined;
    domain.issuingAuthority = req.issuingAuthority
      ? new EncString(req.issuingAuthority)
      : undefined;
    domain.licenseClass = req.licenseClass ? new EncString(req.licenseClass) : undefined;
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

    this.firstName = safeGetString(o.firstName);
    this.middleName = safeGetString(o.middleName);
    this.lastName = safeGetString(o.lastName);
    this.dateOfBirth = safeGetString(o.dateOfBirth);
    this.licenseNumber = safeGetString(o.licenseNumber);
    this.issuingCountry = safeGetString(o.issuingCountry);
    this.issuingState = safeGetString(o.issuingState);
    this.issueDate = safeGetString(o.issueDate);
    this.expirationDate = safeGetString(o.expirationDate);
    this.issuingAuthority = safeGetString(o.issuingAuthority);
    this.licenseClass = safeGetString(o.licenseClass);
  }
}
