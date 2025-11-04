import { EncString } from "../../key-management/crypto/models/enc-string";
import { Identity as IdentityDomain } from "../../vault/models/domain/identity";
import { IdentityView } from "../../vault/models/view/identity.view";

import { safeGetString } from "./utils";

export class IdentityExport {
  static template(): IdentityExport {
    const req = new IdentityExport();
    req.title = "Mr";
    req.firstName = "John";
    req.middleName = "William";
    req.lastName = "Doe";
    req.address1 = "123 Any St";
    req.address2 = "Apt #123";
    req.address3 = "";
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
    domain.title = new EncString(req.title ?? "");
    domain.firstName = new EncString(req.firstName ?? "");
    domain.middleName = new EncString(req.middleName ?? "");
    domain.lastName = new EncString(req.lastName ?? "");
    domain.address1 = new EncString(req.address1 ?? "");
    domain.address2 = new EncString(req.address2 ?? "");
    domain.address3 = new EncString(req.address3 ?? "");
    domain.city = new EncString(req.city ?? "");
    domain.state = new EncString(req.state ?? "");
    domain.postalCode = new EncString(req.postalCode ?? "");
    domain.country = new EncString(req.country ?? "");
    domain.company = new EncString(req.company ?? "");
    domain.email = new EncString(req.email ?? "");
    domain.phone = new EncString(req.phone ?? "");
    domain.ssn = new EncString(req.ssn ?? "");
    domain.username = new EncString(req.username ?? "");
    domain.passportNumber = new EncString(req.passportNumber ?? "");
    domain.licenseNumber = new EncString(req.licenseNumber ?? "");
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

    this.title = safeGetString(o.title);
    this.firstName = safeGetString(o.firstName);
    this.middleName = safeGetString(o.middleName);
    this.lastName = safeGetString(o.lastName);
    this.address1 = safeGetString(o.address1);
    this.address2 = safeGetString(o.address2);
    this.address3 = safeGetString(o.address3);
    this.city = safeGetString(o.city);
    this.state = safeGetString(o.state);
    this.postalCode = safeGetString(o.postalCode);
    this.country = safeGetString(o.country);
    this.company = safeGetString(o.company);
    this.email = safeGetString(o.email);
    this.phone = safeGetString(o.phone);
    this.ssn = safeGetString(o.ssn);
    this.username = safeGetString(o.username);
    this.passportNumber = safeGetString(o.passportNumber);
    this.licenseNumber = safeGetString(o.licenseNumber);
  }
}
