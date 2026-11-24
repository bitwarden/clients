import { EncString } from "@bitwarden/sdk-internal";

import { Identity as IdentityDomain } from "../../vault/models/domain/identity";
import { IdentityView } from "../../vault/models/view/identity.view";

export class IdentityExport {
  static template(): IdentityExport {
    const req = new IdentityExport();
    req.title = "Mr";
    req.firstName = "John";
    req.middleName = "William";
    req.lastName = "Doe";
    req.address1 = "123 Any St";
    req.address2 = "Apt #123";
    req.city = "New York";
    req.state = "NY";
    req.postalCode = "10001";
    req.country = "US";
    req.company = "Acme Inc.";
    req.email = "john@company.com";
    req.phone = "5555551234";
    req.ssn = "000-123-4567";
    req.username = "jdoe";
    req.passportNumber = "US-123456789";
    req.licenseNumber = "D123-12-123-12333";
    return req;
  }

  static toView(req: IdentityExport, view = new IdentityView()) {
    view.title = req.title;
    view.firstName = req.firstName;
    view.middleName = req.middleName;
    view.lastName = req.lastName;
    view.address1 = req.address1;
    view.address2 = req.address2;
    view.address3 = req.address3;
    view.city = req.city;
    view.state = req.state;
    view.postalCode = req.postalCode;
    view.country = req.country;
    view.company = req.company;
    view.email = req.email;
    view.phone = req.phone;
    view.ssn = req.ssn;
    view.username = req.username;
    view.passportNumber = req.passportNumber;
    view.licenseNumber = req.licenseNumber;
    return view;
  }

  static toDomain(req: IdentityExport, domain = new IdentityDomain()) {
    domain.title = req.title != null ? (req.title as EncString) : undefined;
    domain.firstName = req.firstName != null ? (req.firstName as EncString) : undefined;
    domain.middleName = req.middleName != null ? (req.middleName as EncString) : undefined;
    domain.lastName = req.lastName != null ? (req.lastName as EncString) : undefined;
    domain.address1 = req.address1 != null ? (req.address1 as EncString) : undefined;
    domain.address2 = req.address2 != null ? (req.address2 as EncString) : undefined;
    domain.address3 = req.address3 != null ? (req.address3 as EncString) : undefined;
    domain.city = req.city != null ? (req.city as EncString) : undefined;
    domain.state = req.state != null ? (req.state as EncString) : undefined;
    domain.postalCode = req.postalCode != null ? (req.postalCode as EncString) : undefined;
    domain.country = req.country != null ? (req.country as EncString) : undefined;
    domain.company = req.company != null ? (req.company as EncString) : undefined;
    domain.email = req.email != null ? (req.email as EncString) : undefined;
    domain.phone = req.phone != null ? (req.phone as EncString) : undefined;
    domain.ssn = req.ssn != null ? (req.ssn as EncString) : undefined;
    domain.username = req.username != null ? (req.username as EncString) : undefined;
    domain.passportNumber =
      req.passportNumber != null ? (req.passportNumber as EncString) : undefined;
    domain.licenseNumber = req.licenseNumber != null ? (req.licenseNumber as EncString) : undefined;
    return domain;
  }

  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  company?: string;
  email?: string;
  phone?: string;
  ssn?: string;
  username?: string;
  passportNumber?: string;
  licenseNumber?: string;

  constructor(o?: IdentityView | IdentityDomain) {
    if (o == null) {
      return;
    }

    this.title = o.title ?? undefined;
    this.firstName = o.firstName ?? undefined;
    this.middleName = o.middleName ?? undefined;
    this.lastName = o.lastName ?? undefined;
    this.address1 = o.address1 ?? undefined;
    this.address2 = o.address2 ?? undefined;
    this.address3 = o.address3 ?? undefined;
    this.city = o.city ?? undefined;
    this.state = o.state ?? undefined;
    this.postalCode = o.postalCode ?? undefined;
    this.country = o.country ?? undefined;
    this.company = o.company ?? undefined;
    this.email = o.email ?? undefined;
    this.phone = o.phone ?? undefined;
    this.ssn = o.ssn ?? undefined;
    this.username = o.username ?? undefined;
    this.passportNumber = o.passportNumber ?? undefined;
    this.licenseNumber = o.licenseNumber ?? undefined;
  }
}
